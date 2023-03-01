import env from '../../app/env.js'
const { API_VERSION } = env

const dscpRuntimeVersion = 451
const ipfsVersion = '0.18.1'

export const responses = {
  ok: {
    code: 200,
    body: {
      status: 'ok',
      version: API_VERSION,
      details: {
        api: {
          status: 'ok',
          detail: {
            chain: 'Development',
            runtime: {
              name: 'dscp',
              versions: {
                authoring: 1,
                impl: 1,
                spec: dscpRuntimeVersion,
                transaction: 1,
              },
            },
          },
        },
        ipfs: {
          status: 'ok',
          detail: {
            version: ipfsVersion,
            peerCount: 1,
          },
        },
      },
    },
  },
  substrateDown: {
    code: 503,
    body: {
      status: 'down',
      version: API_VERSION,
      details: {
        api: {
          status: 'down',
          detail: {
            message: 'Cannot connect to substrate node',
          },
        },
        ipfs: {
          status: 'ok',
          detail: {
            version: ipfsVersion,
            peerCount: 1,
          },
        },
      },
    },
  },
  ipfsDown: {
    code: 503,
    body: {
      status: 'down',
      version: API_VERSION,
      details: {
        api: {
          status: 'ok',
          detail: {
            chain: 'Development',
            runtime: {
              name: 'dscp',
              versions: {
                authoring: 1,
                impl: 1,
                spec: dscpRuntimeVersion,
                transaction: 1,
              },
            },
          },
        },
        ipfs: {
          status: 'down',
          detail: {
            message: 'Error getting status from IPFS node',
          },
        },
      },
    },
  },
  ipfsDownTimeout: {
    code: 503,
    body: {
      status: 'down',
      version: API_VERSION,
      details: {
        api: {
          status: 'ok',
          detail: {
            chain: 'Development',
            runtime: {
              name: 'dscp',
              versions: {
                authoring: 1,
                impl: 1,
                spec: dscpRuntimeVersion,
                transaction: 1,
              },
            },
          },
        },
        ipfs: {
          status: 'down',
          detail: {
            message: 'Timeout fetching status',
          },
        },
      },
    },
  },
  ipfsDownNoPeers: {
    code: 503,
    body: {
      status: 'down',
      version: API_VERSION,
      details: {
        api: {
          status: 'ok',
          detail: {
            chain: 'Development',
            runtime: {
              name: 'dscp',
              versions: {
                authoring: 1,
                impl: 1,
                spec: dscpRuntimeVersion,
                transaction: 1,
              },
            },
          },
        },
        ipfs: {
          status: 'down',
          detail: {
            version: ipfsVersion,
            peerCount: 0,
          },
        },
      },
    },
  },
}
