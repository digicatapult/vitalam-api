import { buildApi } from '@digicatapult/dscp-node'

import env from '../env.js'
import logger from '../logger.js'

const { API_HOST, API_PORT } = env

const { api, keyring: kr } = buildApi({
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

export const substrateApi = api
export const keyring = kr
