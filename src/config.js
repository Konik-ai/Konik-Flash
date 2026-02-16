const isDev = import.meta.env.DEV
const loaderUrl = isDev
  ? '/qdl/programmer.bin'
  : 'https://raw.githubusercontent.com/commaai/flash/master/src/QDL/programmer.bin'

const config = {
  versions: [
    {
      id: 'agnos-16',
      name: 'AGNOS 16',
      manifest: 'https://storage.konik.ai/agnosupdate/16/all-partitions.json',
      isLatest: true,
      devices: ['konik-a1', 'comma-3x'], // Only for Konik A1/A1M and comma 3x
    },
    {
      id: 'agnos-12.8',
      name: 'AGNOS 12.8',
      manifest: 'https://storage.konik.ai/agnosupdate/12.8/all-partitions.json',
      isLatest: true,
      devices: ['comma-three'], // Only for comma three
    },
  ],
  loader: {
    url: loaderUrl,
  },
}

export default config
