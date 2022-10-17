import startApiStatus from './apiStatus.js'
import startIpfsStatus from './ipfsStatus.js'
import { buildCombinedHandler } from '../util/statusPoll.js'

export const startStatusHandlers = async () => {
  const handlers = new Map()
  const [apiStatus, ipfsStatus] = await Promise.all([startApiStatus(), startIpfsStatus()])
  handlers.set('api', apiStatus)
  handlers.set('ipfs', ipfsStatus)

  return buildCombinedHandler(handlers)
}
