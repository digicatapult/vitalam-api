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
                spec: 300,
                transaction: 1,
              },
            },
          },
        },
      },
    },
  },
  down: {
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
      },
    },
  },
}

module.exports = {
  responses,
}
