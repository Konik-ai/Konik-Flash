import { qdlDevice } from '@commaai/qdl'
import { usbClass } from '@commaai/qdl/usblib'

import { getManifest } from './manifest'
import { createSteps, withProgress } from './progress'

export const StepCode = {
  INITIALIZING: 0,
  READY: 1,
  CONNECTING: 2,
  REPAIR_PARTITION_TABLES: 3,
  ERASE_DEVICE: 4,
  FLASH_SYSTEM: 5,
  FINALIZING: 6,
  DONE: 7,
}

export const ErrorCode = {
  UNKNOWN: -1,
  NONE: 0,
  REQUIREMENTS_NOT_MET: 1,
  STORAGE_SPACE: 2,
  UNRECOGNIZED_DEVICE: 3,
  LOST_CONNECTION: 4,
  REPAIR_PARTITION_TABLES_FAILED: 5,
  ERASE_FAILED: 6,
  FLASH_SYSTEM_FAILED: 7,
  FINALIZING_FAILED: 8,
}

/**
 * @param {any} storageInfo
 * @returns {string|null}
 */
export function checkCompatibleDevice(storageInfo) {
  // Should be the same for all comma 3/3X
  if (storageInfo.block_size !== 4096 || storageInfo.page_size !== 4096 ||
    storageInfo.num_physical !== 6 || storageInfo.mem_type !== 'UFS') {
    throw new Error('UFS chip parameters mismatch')
  }

  // Check total_blocks to determine device type regardless of name/manufacturer
  // 64GB devices (comma three and similar SOMs) - approximately 14M blocks
  if (storageInfo.total_blocks <= 16777216) { // 16M block limit with buffer
    return 'userdata_30'
  }

  // 128GB devices (comma 3X) - approximately 29M blocks
  // Support both userdata_89 and userdata_90 variants based on exact total_blocks
  if (storageInfo.total_blocks === 29605888) {
    return 'userdata_89'
  }
  if (storageInfo.total_blocks === 29775872) {
    return 'userdata_90'
  }

  throw new Error('Could not identify UFS chip')
}

/**
 * @template T
 * @callback ChangeCallback
 * @param {T} value
 * @returns {void}
 */

/**
 * @typedef {object} FlashManagerCallbacks
 * @property {ChangeCallback<number>} [onStepChange]
 * @property {ChangeCallback<string>} [onMessageChange]
 * @property {ChangeCallback<number>} [onProgressChange]
 * @property {ChangeCallback<number>} [onErrorChange]
 * @property {ChangeCallback<boolean>} [onConnectionChange]
 * @property {ChangeCallback<string>} [onSerialChange]
 */

/**
 * @typedef {object} FlashManagerOptions
 * @property {boolean} [flashUserdata=true]
 */

export class FlashManager {
  /** @type {string} */
  #userdataImage
  /** @type {boolean} */
  #flashUserdata

  /**
   * @param {string} manifestUrl
   * @param {ArrayBuffer} programmer
   * @param {FlashManagerCallbacks} callbacks
   * @param {FlashManagerOptions} options
   */
  constructor(manifestUrl, programmer, callbacks = {}, options = {}) {
    this.manifestUrl = manifestUrl
    this.callbacks = callbacks
    this.device = new qdlDevice(programmer)
    /** @type {import('./image').ImageManager|null} */
    this.imageManager = null
    /** @type {ManifestImage[]|null} */
    this.manifest = null
    this.step = StepCode.INITIALIZING
    this.error = ErrorCode.NONE
    this.#flashUserdata = options.flashUserdata ?? true
  }

  /** @param {number} step */
  #setStep(step) {
    this.step = step
    this.callbacks.onStepChange?.(step)
  }

  /** @param {string} message */
  #setMessage(message) {
    if (message) console.info('[Flash]', message)
    this.callbacks.onMessageChange?.(message)
  }

  /** @param {number} progress */
  #setProgress(progress) {
    this.callbacks.onProgressChange?.(progress)
  }

  /** @param {number} error */
  #setError(error) {
    this.error = error
    this.callbacks.onErrorChange?.(error)
    this.#setProgress(-1)

    if (error !== ErrorCode.NONE) {
      console.debug('[Flash] error', error)
    }
  }

  /** @param {boolean} connected */
  #setConnected(connected) {
    this.callbacks.onConnectionChange?.(connected)
  }

  /** @param {string} serial */
  #setSerial(serial) {
    this.callbacks.onSerialChange?.(serial)
  }

  /** @returns {boolean} */
  #checkRequirements() {
    if (typeof navigator.usb === 'undefined') {
      console.error('[Flash] WebUSB not supported')
      this.#setError(ErrorCode.REQUIREMENTS_NOT_MET)
      return false
    }
    if (typeof Worker === 'undefined') {
      console.error('[Flash] Web Workers not supported')
      this.#setError(ErrorCode.REQUIREMENTS_NOT_MET)
      return false
    }
    if (typeof Storage === 'undefined') {
      console.error('[Flash] Storage API not supported')
      this.#setError(ErrorCode.REQUIREMENTS_NOT_MET)
      return false
    }
    return true
  }

  /** @param {import('./image').ImageManager} imageManager */
  async initialize(imageManager) {
    this.imageManager = imageManager
    this.#setProgress(-1)
    this.#setMessage('')

    if (!this.#checkRequirements()) {
      return
    }

    try {
      await this.imageManager.init()
    } catch (err) {
      console.error('[Flash] Failed to initialize image worker')
      console.error(err)
      if (err instanceof String && err.startsWith('Not enough storage')) {
        this.#setError(ErrorCode.STORAGE_SPACE)
        this.#setMessage(err)
      } else {
        this.#setError(ErrorCode.UNKNOWN)
      }
      return
    }

    if (!this.manifest?.length) {
      try {
        this.manifest = await getManifest(this.manifestUrl)
        if (this.manifest.length === 0) {
          throw new Error('Manifest is empty')
        }
      } catch (err) {
        console.error('[Flash] Failed to fetch manifest')
        console.error(err)
        this.#setError(ErrorCode.UNKNOWN)
        return
      }
      console.info('[Flash] Loaded manifest', this.manifest)
    }

    this.#setStep(StepCode.READY)
  }

  async #connect() {
    this.#setStep(StepCode.CONNECTING)
    this.#setProgress(-1)

    let usb
    try {
      usb = new usbClass()
    } catch (err) {
      console.error('[Flash] Connection lost', err)
      this.#setStep(StepCode.READY)
      this.#setConnected(false)
      return
    }

    try {
      await this.device.connect(usb)
    } catch (err) {
      console.error('[Flash] Connection error', err)
      this.#setError(ErrorCode.LOST_CONNECTION)
      this.#setConnected(false)
      return
    }

    console.info('[Flash] Connected')
    this.#setConnected(true)

    let storageInfo
    try {
      storageInfo = await this.device.getStorageInfo()
    } catch (err) {
      console.error('[Flash] Connection lost', err)
      this.#setError(ErrorCode.LOST_CONNECTION)
      this.#setConnected(false)
      return
    }

    try {
      this.#userdataImage = checkCompatibleDevice(storageInfo)
    } catch (e) {
      console.error('[Flash] Could not identify device:', e)
      console.error(storageInfo)
      this.#setError(ErrorCode.UNRECOGNIZED_DEVICE)
      return
    }

    const serialNum = Number(storageInfo.serial_num).toString(16).padStart(8, '0')
    console.info('[Flash] Device info', { serialNum, storageInfo, userdataImage: this.#userdataImage })
    this.#setSerial(serialNum)
  }

  async #repairPartitionTables() {
    this.#setStep(StepCode.REPAIR_PARTITION_TABLES)
    this.#setProgress(0)

    // TODO: check that we have an image for each LUN (storageInfo.num_physical)
    const gptImages = this.manifest.filter((image) => !!image.gpt)
    if (gptImages.length === 0) {
      console.error('[Flash] No GPT images found')
      this.#setError(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
      return
    }

    try {
      for await (const [image, onProgress] of withProgress(gptImages, this.#setProgress.bind(this))) {
        // TODO: track repair progress
        const [onDownload, onRepair] = createSteps([2, 1], onProgress)

        // Download GPT image
        await this.imageManager.downloadImage(image, onDownload)
        const blob = await this.imageManager.getImage(image);

        // Recreate main and backup GPT for this LUN
        if (!await this.device.repairGpt(image.gpt.lun, blob)) {
          throw new Error(`Repairing LUN ${image.gpt.lun} failed`)
        }
        onRepair(1.0)
      }
    } catch (err) {
      console.error('[Flash] An error occurred while repairing partition tables')
      console.error(err)
      this.#setError(ErrorCode.REPAIR_PARTITION_TABLES_FAILED)
    }
  }

  async #eraseDevice() {
    this.#setStep(StepCode.ERASE_DEVICE)
    this.#setProgress(-1)

    // TODO: use storageInfo.num_physical
    const luns = Array.from({ length: 6 }).map((_, i) => i)

    const [found, persistLun, partition] = await this.device.detectPartition('persist')
    if (!found || luns.indexOf(persistLun) < 0) {
      console.error('[Flash] Could not find "persist" partition', { found, persistLun, partition })
      this.#setError(ErrorCode.ERASE_FAILED)
      return
    }
    if (persistLun !== 0 || partition.start !== 8n || partition.sectors !== 8192n) {
      console.error('[Flash] Partition "persist" does not have expected properties', { found, persistLun, partition })
      this.#setError(ErrorCode.ERASE_FAILED)
      return
    }
    console.info(`[Flash] "persist" partition located in LUN ${persistLun}`)

    // Check if userdata partition exists (only if we want to preserve it)
    let userdataLun = -1
    if (!this.#flashUserdata) {
      const [userdataFound, foundLun] = await this.device.detectPartition('userdata')
      if (userdataFound && luns.indexOf(foundLun) >= 0) {
        userdataLun = foundLun
        console.info(`[Flash] "userdata" partition located in LUN ${userdataLun}, will be preserved`)
      } else {
        console.warn('[Flash] "userdata" partition not found, cannot preserve it (will be created during flash)')
      }
    }

    try {
      // Erase each LUN, avoid erasing critical partitions and persist
      const critical = ['mbr', 'gpt']
      for (const lun of luns) {
        const preserve = [...critical]
        if (lun === persistLun) preserve.push('persist')
        // Only preserve userdata if it was found
        if (!this.#flashUserdata && lun === userdataLun) preserve.push('userdata')
        console.info(`[Flash] Erasing LUN ${lun} while preserving ${preserve.map((part) => `"${part}"`).join(', ')} partitions`)
        if (!await this.device.eraseLun(lun, preserve)) {
          throw new Error(`Erasing LUN ${lun} failed`)
        }
      }
    } catch (err) {
      console.error('[Flash] An error occurred while erasing device')
      console.error(err)
      this.#setError(ErrorCode.ERASE_FAILED)
    }
  }

  async #flashSystem() {
    this.#setStep(StepCode.FLASH_SYSTEM)
    this.#setProgress(0)

    // Exclude GPT images and persist image, and pick correct userdata image to flash
    const systemImages = this.manifest
      .filter((image) => !image.gpt && image.name !== 'persist')
      .filter((image) => {
        // Skip all userdata images if flashUserdata is disabled
        if (!this.#flashUserdata && image.name.startsWith('userdata_')) {
          return false
        }
        // Otherwise, pick the correct userdata image for this device
        return !image.name.startsWith('userdata_') || image.name === this.#userdataImage
      })

    // if (!systemImages.find((image) => image.name === this.#userdataImage)) {
    //   console.error(`[Flash] Did not find userdata image "${this.#userdataImage}"`)
    //   this.#setError(ErrorCode.UNKNOWN)
    //   return
    // }

    try {
      for await (const image of systemImages) {
        const [onDownload, onFlash] = createSteps([1, image.hasAB ? 2 : 1], this.#setProgress.bind(this))

        this.#setMessage(`Downloading ${image.name}`)
        await this.imageManager.downloadImage(image, onDownload)
        const blob = await this.imageManager.getImage(image)
        onDownload(1.0)

        // Flash image to each slot
        const slots = image.hasAB ? ['_a', '_b'] : ['']
        for (const [slot, onSlotProgress] of withProgress(slots, onFlash)) {
          // NOTE: userdata image name does not match partition name
          const partitionName = `${image.name.startsWith('userdata_') ? 'userdata' : image.name}${slot}`

          this.#setMessage(`Flashing ${partitionName}`)
          if (!await this.device.flashBlob(partitionName, blob, (progress) => onSlotProgress(progress / image.size), false)) {
            throw new Error(`Flashing partition "${partitionName}" failed`)
          }
          onSlotProgress(1.0)
        }
      }
    } catch (err) {
      console.error('[Flash] An error occurred while flashing system')
      console.error(err)
      this.#setError(ErrorCode.FLASH_SYSTEM_FAILED)
    }
  }

  async #finalize() {
    this.#setStep(StepCode.FINALIZING)
    this.#setProgress(-1)
    this.#setMessage('Finalizing...')

    // Set bootable LUN and update active partitions
    if (!await this.device.setActiveSlot('a')) {
      console.error('[Flash] Failed to update slot')
      this.#setError(ErrorCode.FINALIZING_FAILED)
    }

    // Reboot the device
    this.#setMessage('Rebooting')
    await this.device.reset()
    this.#setConnected(false)

    this.#setStep(StepCode.DONE)
  }

  async start() {
    if (this.step !== StepCode.READY) return
    await this.#connect()
    if (this.error !== ErrorCode.NONE) return
    let start = performance.now()
    await this.#repairPartitionTables()
    console.info(`Repaired partition tables in ${((performance.now() - start) / 1000).toFixed(2)}s`)
    if (this.error !== ErrorCode.NONE) return
    start = performance.now()
    await this.#eraseDevice()
    console.info(`Erased device in ${((performance.now() - start) / 1000).toFixed(2)}s`)
    if (this.error !== ErrorCode.NONE) return
    start = performance.now()
    await this.#flashSystem()
    console.info(`Flashed system in ${((performance.now() - start) / 1000).toFixed(2)}s`)
    if (this.error !== ErrorCode.NONE) return
    start = performance.now()
    await this.#finalize()
    console.info(`Finalized in ${((performance.now() - start) / 1000).toFixed(2)}s`)
  }
}
