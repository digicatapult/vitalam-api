import env from '../../app/env.js'
const { API_VERSION } = env

export const responses = {
  ok: (sqncRuntimeVersion, ipfsVersion) => ({
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
              name: 'sqnc',
              versions: {
                authoring: 1,
                impl: 1,
                spec: sqncRuntimeVersion,
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
  }),
  substrateDown: (ipfsVersion) => ({
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
  }),
  ipfsDown: (sqncRuntimeVersion) => ({
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
              name: 'sqnc',
              versions: {
                authoring: 1,
                impl: 1,
                spec: sqncRuntimeVersion,
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
  }),
  ipfsDownTimeout: (sqncRuntimeVersion) => ({
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
              name: 'sqnc',
              versions: {
                authoring: 1,
                impl: 1,
                spec: sqncRuntimeVersion,
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
  }),
  ipfsDownNoPeers: (sqncRuntimeVersion, ipfsVersion) => ({
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
              name: 'sqnc',
              versions: {
                authoring: 1,
                impl: 1,
                spec: sqncRuntimeVersion,
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
  }),
}
