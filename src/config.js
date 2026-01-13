const isDev = import.meta.env.DEV
const manifestBaseUrl = isDev ? '/agnosupdate' : 'https://raw.githubusercontent.com/hoofpilot/hoofpilot'
const loaderUrl = isDev
  ? '/qdl/programmer.bin'
  : 'https://raw.githubusercontent.com/commaai/flash/master/src/QDL/programmer.bin'

const config = {
  versions: [
    {
      id: 'agnos-15.1',
      name: 'AGNOS 15.1',
      manifest: `${manifestBaseUrl}/master/system/hardware/tici/all-partitions.json`,
      isLatest: true,
    },
  ],
  loader: {
    url: loaderUrl,
  },
}

export default config
