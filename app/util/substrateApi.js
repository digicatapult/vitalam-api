import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'

import env from '../env.js'
import logger from '../logger.js'

const { API_HOST, API_PORT } = env

const provider = new WsProvider(`ws://${API_HOST}:${API_PORT}`)
const api = new ApiPromise({ provider })

api.isReadyOrError.catch(() => {}) // prevent unhandled promise rejection errors

api.on('disconnected', () => {
  logger.warn(`Disconnected from substrate node at ${API_HOST}:${API_PORT}`)
})

api.on('connected', () => {
  logger.info(`Connected to substrate node at ${API_HOST}:${API_PORT}`)
})

api.on('error', (err) => {
  logger.error(`Error from substrate node connection. Error was ${err.message || JSON.stringify(err)}`)
})

export const substrateApi = api
export const keyring = new Keyring({ type: 'sr25519' })
