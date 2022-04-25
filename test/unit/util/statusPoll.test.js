const { describe, beforeEach, afterEach, it } = require('mocha')
const sinon = require('sinon')
const { expect } = require('chai')

const { serviceState, startStatusHandler, buildCombinedHandler } = require('../../../app/util/statusPoll')

const okStatus = (i) => ({
  status: serviceState.UP,
  detail: i,
})

const withFakeTimesForEvery = function () {
  beforeEach(function () {
    this.clock = sinon.useFakeTimers()
  })
  afterEach(function () {
    this.clock.restore()
  })
}

const stopAfterEvery = function () {
  afterEach(function () {
    if (this.handler) {
      this.handler.close()
    }
  })
}

const pollingPeriodMs = 1000
const serviceTimeoutMs = 100

describe('startStatusHandler', function () {
  withFakeTimesForEvery()
  stopAfterEvery()

  it('should get the service status immediately', async function () {
    this.handler = await startStatusHandler({
      pollingPeriodMs,
      serviceTimeoutMs,
      getStatus: sinon.stub().resolves(okStatus(0)),
    })
    const status = this.handler.status
    const detail = this.handler.detail
    expect(status).to.deep.equal(serviceState.UP)
    expect(detail).to.deep.equal(0)
  })

  it('should poll status every period', async function () {
    this.handler = await startStatusHandler({
      pollingPeriodMs,
      serviceTimeoutMs,
      getStatus: Array(10)
        .fill(null)
        .reduce((stub, _, i) => {
          return stub.onCall(i).resolves(okStatus(i))
        }, sinon.stub()),
    })
    await this.clock.tickAsync(pollingPeriodMs / 2)
    for (let i = 0; i < 10; i++) {
      await this.clock.tickAsync(pollingPeriodMs / 2)
      const status = this.handler.status
      const detail = this.handler.detail
      expect(status).to.deep.equal(serviceState.UP)
      expect(detail).to.deep.equal(1 + (i >> 1))
    }
  })

  it('should report status error if poll handler throws', async function () {
    this.handler = await startStatusHandler({
      pollingPeriodMs,
      serviceTimeoutMs,
      getStatus: sinon.stub().rejects(new Error()),
    })
    const status = this.handler.status
    expect(status).to.deep.equal(serviceState.ERROR)
    const detail = this.handler.detail
    expect(detail).to.deep.equal(null)
  })

  it('should report status error if poll handler returns jibberish', async function () {
    this.handler = await startStatusHandler({
      pollingPeriodMs,
      serviceTimeoutMs,
      getStatus: sinon.stub().resolves('jibberish'),
    })
    const status = this.handler.status
    expect(status).to.deep.equal(serviceState.ERROR)
    const detail = this.handler.detail
    expect(detail).to.deep.equal(null)
  })

  it('should report status error if poll handler returns an invalid status', async function () {
    this.handler = await startStatusHandler({
      pollingPeriodMs,
      serviceTimeoutMs,
      getStatus: sinon.stub().resolves({ status: 'invalid' }),
    })
    const status = this.handler.status
    expect(status).to.deep.equal(serviceState.ERROR)
    const detail = this.handler.detail
    expect(detail).to.deep.equal(null)
  })

  it('should report status error if poll handler times out', async function () {
    this.handler = await startStatusHandler({
      pollingPeriodMs,
      serviceTimeoutMs,
      getStatus: sinon
        .stub()
        .onFirstCall()
        .resolves({ status: serviceState.UP })
        .onSecondCall()
        .returns(new Promise(() => {})),
    })
    await this.clock.tickAsync(pollingPeriodMs)
    await this.clock.tickAsync(serviceTimeoutMs)
    const status = this.handler.status
    expect(status).to.deep.equal(serviceState.DOWN)
    const detail = this.handler.detail
    expect(detail).to.deep.equal({
      message: 'Timeout fetching status',
    })
  })

  it('should not allow detail to be undefined', async function () {
    this.handler = await startStatusHandler({
      pollingPeriodMs,
      serviceTimeoutMs,
      getStatus: sinon.stub().resolves({ status: serviceState.UP }),
    })
    const status = this.handler.status
    const detail = this.handler.detail
    expect(status).to.deep.equal(serviceState.UP)
    expect(detail).to.deep.equal(null)
  })

  it('should not poll after calling stop', async function () {
    this.handler = await startStatusHandler({
      pollingPeriodMs,
      serviceTimeoutMs,
      getStatus: Array(10)
        .fill(null)
        .reduce((stub, _, i) => {
          return stub.onCall(i).resolves(okStatus(i))
        }, sinon.stub()),
    })
    await this.clock.tickAsync(pollingPeriodMs / 2)
    for (let i = 0; i < 5; i++) {
      await this.clock.tickAsync(pollingPeriodMs / 2)
      const status = this.handler.status
      const detail = this.handler.detail
      expect(status).to.deep.equal(serviceState.UP)
      expect(detail).to.deep.equal(1 + (i >> 1))
    }
    this.handler.close()
    for (let i = 5; i < 10; i++) {
      await this.clock.tickAsync(pollingPeriodMs / 2)
      const status = this.handler.status
      const detail = this.handler.detail
      expect(status).to.deep.equal(serviceState.UP)
      expect(detail).to.deep.equal(1 + (5 >> 1))
    }
  })
})

describe('buildCombinedHandler', function () {
  it('should combine multiple UP statuses to UP', async function () {
    const handlersMap = new Map([
      ['a', { status: serviceState.UP, detail: 1 }],
      ['b', { status: serviceState.UP, detail: 2 }],
    ])
    const result = await buildCombinedHandler(handlersMap)
    expect(result.status).to.equal(serviceState.UP)
    expect(result.detail).to.deep.equal({
      a: {
        status: serviceState.UP,
        detail: 1,
      },
      b: {
        status: serviceState.UP,
        detail: 2,
      },
    })
  })

  it('should combine UP and DOWN statuses to DOWN', async function () {
    const handlersMap = new Map([
      ['a', { status: serviceState.UP, detail: 1 }],
      ['b', { status: serviceState.DOWN, detail: 2 }],
    ])
    const result = await buildCombinedHandler(handlersMap)
    expect(result.status).to.equal(serviceState.DOWN)
    expect(result.detail).to.deep.equal({
      a: {
        status: serviceState.UP,
        detail: 1,
      },
      b: {
        status: serviceState.DOWN,
        detail: 2,
      },
    })
  })

  it('should combine UP and ERROR statuses to ERROR', async function () {
    const handlersMap = new Map([
      ['a', { status: serviceState.UP, detail: 1 }],
      ['b', { status: serviceState.ERROR, detail: 2 }],
    ])
    const result = await buildCombinedHandler(handlersMap)
    expect(result.status).to.equal(serviceState.ERROR)
    expect(result.detail).to.deep.equal({
      a: {
        status: serviceState.UP,
        detail: 1,
      },
      b: {
        status: serviceState.ERROR,
        detail: 2,
      },
    })
  })

  it('should combine DOWN and ERROR statuses to DOWN', async function () {
    const handlersMap = new Map([
      ['a', { status: serviceState.DOWN, detail: 1 }],
      ['b', { status: serviceState.ERROR, detail: 2 }],
    ])
    const result = await buildCombinedHandler(handlersMap)
    expect(result.status).to.equal(serviceState.DOWN)
    expect(result.detail).to.deep.equal({
      a: {
        status: serviceState.DOWN,
        detail: 1,
      },
      b: {
        status: serviceState.ERROR,
        detail: 2,
      },
    })
  })
})
