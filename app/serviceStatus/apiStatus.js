const { startStatusHandler, serviceState } = require('../util/statusPoll')
const { substrateApi } = require('../util/substrateApi')
const { SUBSTRATE_STATUS_POLL_PERIOD_MS, SUBSTRATE_STATUS_TIMEOUT_MS } = require('../env')

const getStatus = async () => {
  await substrateApi.isReady
  const [chain, runtime] = await Promise.all([substrateApi.runtimeChain, substrateApi.runtimeVersion])
  return {
    status: serviceState.UP,
    detail: {
      chain,
      runtime: {
        name: runtime.specName,
        versions: {
          spec: runtime.specVersion.toNumber(),
          impl: runtime.implVersion.toNumber(),
          authoring: runtime.authoringVersion.toNumber(),
          transaction: runtime.transactionVersion.toNumber(),
        },
      },
    },
  }
}

const startApiStatus = () =>
  startStatusHandler({
    getStatus,
    pollingPeriodMs: SUBSTRATE_STATUS_POLL_PERIOD_MS,
    serviceTimeoutMs: SUBSTRATE_STATUS_TIMEOUT_MS,
  })

module.exports = startApiStatus
