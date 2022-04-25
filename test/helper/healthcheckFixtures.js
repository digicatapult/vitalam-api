const { API_VERSION } = require('../../app/env')

const responses = {
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
                spec: 310,
                transaction: 1,
              },
            },
          },
        },
        ipfs: {
          status: 'ok',
          detail: {
            version: '0.12.2',
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
            version: '0.12.2',
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
                spec: 310,
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
                spec: 310,
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
                spec: 310,
                transaction: 1,
              },
            },
          },
        },
        ipfs: {
          status: 'down',
          detail: {
            version: '0.12.2',
            peerCount: 0,
          },
        },
      },
    },
  },
}

module.exports = {
  responses,
}
