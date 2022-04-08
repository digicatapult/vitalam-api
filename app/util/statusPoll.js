const serviceState = {
  UP: Symbol('status-up'),
  DOWN: Symbol('status-down'),
  ERROR: Symbol('status-error'),
}
const stateSymbols = new Set(Object.values(serviceState))

const delay = (delayMs, result) => new Promise((resolve) => setTimeout(resolve, delayMs, result))

const startStatusHandler = async ({ pollingPeriodMs, serviceTimeoutMs, getStatus }) => {
  let status = null

  const updateStatus = async function* () {
    while (true) {
      try {
        const newStatus = await Promise.race([
          getStatus(),
          delay(serviceTimeoutMs, { status: serviceState.ERROR, detail: null }),
        ])

        if (stateSymbols.has(newStatus.status)) {
          yield {
            status: newStatus.status,
            detail: newStatus.detail === undefined ? null : newStatus.detail,
          }
          continue
        }
        throw new Error('Status is not a valid value')
      } catch (err) {
        yield {
          status: serviceState.ERROR,
          detail: null,
        }
      }
    }
  }

  const statusGen = updateStatus()
  status = (await statusGen.next()).value

  const statusLoop = async function () {
    await delay(pollingPeriodMs)
    for await (const newStatus of statusGen) {
      status = newStatus
      await delay(pollingPeriodMs)
    }
  }
  statusLoop()

  return {
    get status() {
      return status.status
    },
    get detail() {
      return status.detail
    },
    close: () => {
      statusGen.return()
    },
  }
}

const buildCombinedHandler = async (handlerMap) => {
  const getStatus = () =>
    [...handlerMap].reduce((acc, [, h]) => {
      const status = h.status
      if (acc === serviceState.UP) {
        return status
      }
      if (acc === serviceState.DOWN) {
        return acc
      }
      if (status === serviceState.DOWN) {
        return status
      }
      return acc
    }, serviceState.UP)

  return {
    get status() {
      return getStatus()
    },
    get detail() {
      return Object.fromEntries([...handlerMap].map(([name, { detail }]) => [name, detail]))
    },
    close: () => {
      for (const { handler } of handlerMap.values) {
        handler.close()
      }
    },
  }
}

module.exports = {
  serviceState,
  startStatusHandler,
  buildCombinedHandler,
}
