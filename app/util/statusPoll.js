const serviceState = {
  UP: Symbol('status-up'),
  DOWN: Symbol('status-down'),
  ERROR: Symbol('status-error'),
}
const UNKNOWN = Symbol('status-unknown')
const stateSymbols = new Set(Object.values(serviceState))

const startStatusHandler = async ({ pollingPeriodMs, serviceTimeoutMs, getStatus }) => {
  const status = {
    status: UNKNOWN,
    detail: null,
  }
  let timeoutHandle = null,
    stop = false

  const resetStatus = () => {
    status.status = serviceState.ERROR
    status.detail = null
  }

  const updateStatus = async () => {
    try {
      const newStatus = await Promise.race([
        getStatus(),
        new Promise((resolve) => setTimeout(resolve, serviceTimeoutMs, { status: serviceState.ERROR, detail: null })),
      ])

      if (stateSymbols.has(newStatus.status)) {
        status.status = newStatus.status
        status.detail = newStatus.detail === undefined ? null : newStatus.detail
      } else {
        resetStatus()
      }
    } catch (err) {
      resetStatus()
    }
  }

  const statusLoop = async () => {
    await updateStatus()
    if (!stop) {
      timeoutHandle = setTimeout(statusLoop, pollingPeriodMs)
    }
  }

  await statusLoop()

  return {
    get status() {
      return status.status
    },
    get detail() {
      return status.detail
    },
    close: () => {
      stop = true
      clearTimeout(timeoutHandle)
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
