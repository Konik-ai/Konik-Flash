const config = {
  versions: [
    {
      id: 'agnos-16',
      name: 'AGNOS 16',
      manifest: 'https://storage.konik.ai/agnosupdate/16/all-partitions.json',
      isLatest: true,
    },
    {
      id: 'agnos-13.1',
      name: 'AGNOS 13.1',
      manifest: 'https://storage.konik.ai/agnosupdate/13.1/all-partitions.json',
      isLatest: false,
    },
    {
      id: 'agnos-12.4',
      name: 'AGNOS 12.4',
      manifest: 'https://storage.konik.ai/agnosupdate/12.4/all-partitions.json',
      isLatest: false,
    },
    {
      id: 'agnos-11.13',
      name: 'AGNOS 11.13',
      manifest: 'https://storage.konik.ai/agnosupdate/11.13/all-partitions.json',
      isLatest: false,
    },
    // WIP
    // {
    //   id: 'agnos-10.1',
    //   name: 'AGNOS 10.1',
    //   manifest: 'https://storage.konik.ai/agnosupdate/10.1/all-partitions.json',
    //   isLatest: false,
    // },
  ],
  manifests: {
    release: 'https://storage.konik.ai/agnosupdate/11.13/all-partitions.json',
    master: 'https://raw.githubusercontent.com/commaai/openpilot/master/system/hardware/tici/all-partitions.json',
  },
  loader: {
    url: 'https://raw.githubusercontent.com/commaai/flash/master/src/QDL/programmer.bin',
  },
}

export default config
