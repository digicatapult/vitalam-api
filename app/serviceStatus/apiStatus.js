const { startStatusHandler, serviceState } = require('../util/statusPoll')
// const { substrateApi } = require('../util/substrateApi')
const { SUBSTRATE_STATUS_POLL_PERIOD_MS, SUBSTRATE_STATUS_TIMEOUT_MS } = require('../env')

const getStatus = () => {
  return {
    status: serviceState.UP,
    detail: {},
  }
}

const startApiStatus = () =>
  startStatusHandler({
    getStatus,
    pollingPeriodMs: SUBSTRATE_STATUS_POLL_PERIOD_MS,
    serviceTimeoutMs: SUBSTRATE_STATUS_TIMEOUT_MS,
  })

module.exports = startApiStatus
