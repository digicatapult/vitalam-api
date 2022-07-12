const { buildApi } = require('@digicatapult/dscp-node')

const { API_HOST, API_PORT } = require('../env')
const logger = require('../logger')

const { api, keyring } = buildApi({
  options: {
    apiHost: API_HOST,
    apiPort: API_PORT,
  },
})

api.on('disconnected', () => {
  logger.warn(`Disconnected from substrate node at ${API_HOST}:${API_PORT}`)
})

api.on('connected', () => {
  logger.info(`Connected to substrate node at ${API_HOST}:${API_PORT}`)
})

api.on('error', (err) => {
  logger.error(`Error from substrate node connection. Error was ${err.message || JSON.stringify(err)}`)
})

module.exports = {
  substrateApi: api,
  keyring,
}
