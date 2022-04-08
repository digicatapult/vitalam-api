const startApiStatus = require('./apiStatus')
const { buildCombinedHandler } = require('../util/statusPoll')

const startStatusHandlers = async () => {
  const handlers = new Map()
  handlers.set('api', await startApiStatus())

  return buildCombinedHandler(handlers)
}

module.exports = {
  startStatusHandlers,
}
