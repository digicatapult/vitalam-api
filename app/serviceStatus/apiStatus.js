const { startStatusHandler, serviceState } = require('../util/statusPoll')
// const { substrateApi } = require('../util/substrateApi')
const { SUBSTRATE_STATUS_POLL_PERIOD_MS } = require('../env')

const getStatus = () => {
  return {
    status: serviceState.UP,
    detail: {},
  }
}

const startApiStatus = () => startStatusHandler({ getStatus, pollingPeriodMs: SUBSTRATE_STATUS_POLL_PERIOD_MS })

module.exports = startApiStatus
