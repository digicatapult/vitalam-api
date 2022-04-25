const startApiStatus = require('./apiStatus')
const startIpfsStatus = require('./ipfsStatus')
const { buildCombinedHandler } = require('../util/statusPoll')

const startStatusHandlers = async () => {
  const handlers = new Map()
  const [apiStatus, ipfsStatus] = await Promise.all([startApiStatus(), startIpfsStatus()])
  handlers.set('api', apiStatus)
  handlers.set('ipfs', ipfsStatus)

  return buildCombinedHandler(handlers)
}

module.exports = {
  startStatusHandlers,
}
