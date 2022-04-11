const { ApiPromise, WsProvider } = require('@polkadot/api')
const types = require('@digicatapult/dscp-node')

const { API_HOST, API_PORT } = require('../env')
const logger = require('../logger')

const provider = new WsProvider(`ws://${API_HOST}:${API_PORT}`)
const apiOptions = {
  provider,
  types,
}
console.log(apiOptions)
const api = new ApiPromise(apiOptions)
api.isReadyOrError.catch(() => {})

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
  types: apiOptions.types,
}
