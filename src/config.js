const config = {
  manifests: {
    release: 'https://storage.konik.ai/agnosupdate/11.13/all-partitions.json',
    master: 'https://raw.githubusercontent.com/commaai/openpilot/master/system/hardware/tici/all-partitions.json',
  },
  loader: {
    url: 'https://raw.githubusercontent.com/commaai/flash/master/src/QDL/programmer.bin',
  },
}

export default config
