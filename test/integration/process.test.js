const createJWKSMock = require('mock-jwks').default
const { describe, test, before, after, afterEach } = require('mocha')
const { expect } = require('chai')
const nock = require('nock')
const moment = require('moment')

const { createHttpServer } = require('../../app/server')
const { postRunProcessWithProcess, getItemRoute } = require('../helper/routeHelper')
const { withNewTestProcess } = require('../helper/substrateHelper')
const USER_ALICE_TOKEN = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
const { rolesEnum } = require('../../app/util/appUtil')
const { AUTH_ISSUER, AUTH_AUDIENCE, PROCESS_IDENTIFIER_LENGTH } = require('../../app/env')

const defaultRole = { [rolesEnum[0]]: USER_ALICE_TOKEN }

describe('process tests', function () {
  const context = {}

  before(async () => {
    nock.disableNetConnect()
    nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'))
  })

  afterEach(() => {
    nock.abortPendingRequests()
    nock.cleanAll()
  })

  before(async function () {
    context.app = await createHttpServer()

    context.jwksMock = createJWKSMock(AUTH_ISSUER)
    context.jwksMock.start()
    context.authToken = context.jwksMock.token({
      aud: AUTH_AUDIENCE,
      iss: AUTH_ISSUER,
    })
  })

  after(async function () {
    await context.jwksMock.stop()
  })

  describe('with correct process', function () {
    withNewTestProcess(context)

    test('add and get item - single metadata FILE', async function () {
      const outputs = [
        { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
      ]
      const runProcessResult = await postRunProcessWithProcess(
        context.app,
        context.authToken,
        context.process,
        [],
        outputs
      )

      expect(runProcessResult.status).to.equal(200)
      expect(runProcessResult.body).to.have.length(1)

      const tokenId = { id: runProcessResult.body[0] }

      const getItemResult = await getItemRoute(context.app, context.authToken, tokenId)
      expect(getItemResult.status).to.equal(200)
      expect(getItemResult.body.id).to.equal(tokenId.id)
      expect(getItemResult.body.metadata_keys).to.deep.equal(['testFile'])
      expect(moment(getItemResult.body.timestamp, moment.ISO_8601, true).isValid()).to.be.true
    })

    test("error with version that doesn't exist", async function () {
      const outputs = [
        { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
      ]
      const version = context.process.version + 1
      const runProcessResult = await postRunProcessWithProcess(
        context.app,
        context.authToken,
        {
          id: context.process.id,
          version,
        },
        [],
        outputs
      )

      expect(runProcessResult.status).to.equal(400)
      expect(runProcessResult.body.message).to.equal(`Process ${context.process.id} version ${version} does not exist`)
    })

    test("error with name that doesn't exist", async function () {
      const outputs = [
        { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
      ]
      const runProcessResult = await postRunProcessWithProcess(
        context.app,
        context.authToken,
        {
          id: 'not-a-process',
          version: context.process.version,
        },
        [],
        outputs
      )

      expect(runProcessResult.status).to.equal(400)
      expect(runProcessResult.body.message).to.equal(
        `Process not-a-process version ${context.process.version} does not exist`
      )
    })

    test('error with name that is too long', async function () {
      const outputs = [
        { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
      ]
      const id = Array(PROCESS_IDENTIFIER_LENGTH + 1)
        .fill('a')
        .join('')
      const runProcessResult = await postRunProcessWithProcess(
        context.app,
        context.authToken,
        {
          id,
          version: context.process.version,
        },
        [],
        outputs
      )

      expect(runProcessResult.status).to.equal(400)
      expect(runProcessResult.body.message).to.equal(`Invalid process id: ${id}`)
    })

    test("error with version that isn't a number", async function () {
      const outputs = [
        { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
      ]
      const version = null
      const runProcessResult = await postRunProcessWithProcess(
        context.app,
        context.authToken,
        {
          id: context.process.id,
          version,
        },
        [],
        outputs
      )

      expect(runProcessResult.status).to.equal(400)
      expect(runProcessResult.body.message).to.equal(`Invalid process version: ${version}`)
    })

    test("error with version that isn't an integer", async function () {
      const outputs = [
        { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
      ]
      const version = 3.14
      const runProcessResult = await postRunProcessWithProcess(
        context.app,
        context.authToken,
        {
          id: context.process.id,
          version,
        },
        [],
        outputs
      )

      expect(runProcessResult.status).to.equal(400)
      expect(runProcessResult.body.message).to.equal(`Invalid process version: ${version}`)
    })

    test("error with version that isn't a 32bit integer", async function () {
      const outputs = [
        { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
      ]
      const version = Number.MAX_SAFE_INTEGER
      const runProcessResult = await postRunProcessWithProcess(
        context.app,
        context.authToken,
        {
          id: context.process.id,
          version,
        },
        [],
        outputs
      )

      expect(runProcessResult.status).to.equal(400)
      expect(runProcessResult.body.message).to.equal(`Invalid process version: ${version}`)
    })
  })
})
