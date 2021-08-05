/* eslint-disable */
const createJWKSMock = require('mock-jwks').default
const { describe, test, before } = require('mocha')
const { expect } = require('chai')
const nock = require('nock')

const { createHttpServer } = require('../../app/server')
const {
  healthCheck,
  getAuthTokenRoute,
  addItemRoute,
  getItemRoute,
  getItemMetadataRoute,
  getLastTokenIdRoute,
  addFileRoute,
  addFileRouteLegacy,
} = require('../helper/routeHelper')
const USER_ALICE_TOKEN = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
const USER_BOB_TOKEN = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'
const { createToken, assertItem } = require('../helper/appHelper')
const { processMetadata, runProcess } = require('../../app/util/appUtil')
const { AUTH_TOKEN_URL, AUTH_ISSUER, AUTH_AUDIENCE } = require('../../app/env')

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = require('base-x')(BASE58)

describe('routes', function () {
  before(async () => {
    nock.disableNetConnect()
    nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'))
  })

  afterEach(() => {
    nock.abortPendingRequests()
    nock.cleanAll()
  })

  describe('health check', function () {
    let app

    before(async function () {
      app = await createHttpServer()
    })

    test('health check', async function () {
      const expectedResult = { status: 'ok' }

      const actualResult = await healthCheck(app)
      expect(actualResult.status).to.equal(200)
      expect(actualResult.body).to.deep.equal(expectedResult)
    })
  })

  describe('access token', async () => {
    // Inputs
    let app
    const tokenResponse = {
      data: {
        access_token: 'fake access token',
        expires_in: 86400,
        token_type: 'Bearer',
      },
    }

    before(async () => {
      app = await createHttpServer()
      nock(AUTH_TOKEN_URL).post('/').reply(200, tokenResponse)
    })

    test('get access token', async () => {
      // Execution
      const res = await getAuthTokenRoute(app)

      // Assertions
      expect(res.error).to.be.false
      expect(res.status).to.equal(200)
      expect(res.body).to.deep.equal(tokenResponse)
    })
  })

  describe('invalid credentials', async () => {
    // Inputs
    let app
    const deniedResponse = {
      data: {
        error: 'access_denied',
        error_description: 'Unauthorized',
      },
    }

    before(async () => {
      app = await createHttpServer()
      nock(AUTH_TOKEN_URL).post('/').reply(401, deniedResponse)
    })

    test('access denied to token', async () => {
      const res = await getAuthTokenRoute(app)

      expect(res.error).to.exist
      expect(res.status).to.equal(401)
      expect(res.body).to.deep.equal(deniedResponse)
    })

    test('invalid token', async function () {
      const result = await getLastTokenIdRoute(app, 'invalidToken')
      expect(result.status).to.equal(401)
    })
  })

  describe('authenticated routes', function () {
    let app
    let jwksMock
    let authToken

    before(async function () {
      app = await createHttpServer()

      jwksMock = createJWKSMock(AUTH_ISSUER)
      jwksMock.start()
      authToken = jwksMock.token({
        aud: AUTH_AUDIENCE,
        iss: AUTH_ISSUER,
      })
    })

    after(async function () {
      await jwksMock.stop()
    })

    test('add and get item', async function () {
      const outputs = [{ owner: USER_ALICE_TOKEN, metadataFile: './test/data/test_file_01.txt' }]
      const addItemResult = await addItemRoute(app, authToken, [], outputs)
      expect(addItemResult.body).to.have.length(1)
      expect(addItemResult.status).to.equal(200)

      const lastToken = await getLastTokenIdRoute(app, authToken)
      expect(lastToken.body).to.have.property('id')

      const getItemResult = await getItemRoute(app, authToken, lastToken.body)
      expect(getItemResult.status).to.equal(200)
      expect(getItemResult.body.id).to.deep.equal(lastToken.body.id)
    })

    test('get item missing', async function () {
      const lastToken = await getLastTokenIdRoute(app, authToken)
      const lastTokenId = lastToken.body.id
      const actualResult = await getItemRoute(app, authToken, { id: lastTokenId + 1000 })
      expect(actualResult.status).to.equal(404)
      expect(actualResult.body).to.have.property('message')
    })

    test('get item invalid', async function () {
      const actualResult = await getItemRoute(app, authToken, { id: 0 })
      expect(actualResult.status).to.equal(400)
      expect(actualResult.body).to.have.property('message')
    })

    test('get item metadata', async function () {
      const lastToken = await getLastTokenIdRoute(app, authToken)
      const lastTokenId = lastToken.body.id
      const dir = await addFileRoute('./test/data/test_file_01.txt')
      const { Hash: base58Metadata } = dir.find((r) => r.Name === '')

      const base64Metadata = `0x${bs58.decode(base58Metadata).toString('hex').slice(4)}`

      const output = { owner: USER_ALICE_TOKEN, metadata: base64Metadata }

      await runProcess([], [output])

      const res = await getItemMetadataRoute(app, authToken, { id: lastTokenId + 1 })

      expect(res.text.toString()).equal('This is the first test file...\n')
      expect(res.header['content-disposition']).equal('attachment; filename="test_file_01.txt"')
    })

    test('get legacy item metadata', async function () {
      const lastToken = await getLastTokenIdRoute(app, authToken)
      const lastTokenId = lastToken.body.id
      const { Hash: base58Metadata } = await addFileRouteLegacy('./test/data/test_file_01.txt')
      const base64Metadata = `0x${bs58.decode(base58Metadata).toString('hex').slice(4)}`

      const output = { owner: USER_ALICE_TOKEN, metadata: base64Metadata }

      await runProcess([], [output])

      const res = await getItemMetadataRoute(app, authToken, { id: lastTokenId + 1 })

      expect(res.text.toString()).equal('This is the first test file...\n')
      expect(res.header['content-disposition']).equal('attachment; filename="metadata"')
    })

    test('get missing item metadata', async function () {
      const lastToken = await getLastTokenIdRoute(app, authToken)
      const lastTokenId = lastToken.body.id
      const actualResult = await getItemMetadataRoute(app, authToken, {
        id: lastTokenId + 1000,
      })

      expect(actualResult.status).to.equal(404)
      expect(actualResult.body).to.have.property('message')
    })

    test('get invalid item metadata', async function () {
      const actualResult = await getItemMetadataRoute(app, authToken, { id: 0 })

      expect(actualResult.status).to.equal(400)
      expect(actualResult.body).to.have.property('message')
    })

    test('run-process creating one token', async function () {
      const lastToken = await getLastTokenIdRoute(app, authToken)
      const lastTokenId = lastToken.body.id

      let expectedResult = [lastTokenId + 1]

      const outputs = [{ owner: USER_BOB_TOKEN, metadataFile: './test/data/test_file_04.txt' }]
      const actualResult = await addItemRoute(app, authToken, [], outputs)

      expect(actualResult.status).to.equal(200)
      expect(actualResult.body).to.deep.equal(expectedResult)

      const item = await getItemRoute(app, authToken, { id: lastTokenId + 1 })
      const itemMetadata = await getItemMetadataRoute(app, authToken, {
        id: lastTokenId + 1,
      })

      expectedResult = {
        id: lastTokenId + 1,
        creator: USER_ALICE_TOKEN,
        owner: USER_BOB_TOKEN,
        parents: [],
        children: null,
      }

      assertItem(item.body, expectedResult)
      expect(itemMetadata.text.toString()).equal('This is the fourth test file...\n')
    })

    test('run-process destroying one token and creating one', async function () {
      const lastToken = await getLastTokenIdRoute(app, authToken)
      const lastTokenId = lastToken.body.id

      let expectedResult = [lastTokenId + 2]

      await addItemRoute(
        app,
        authToken,
        [],
        [
          {
            owner: USER_ALICE_TOKEN,
            metadataFile: './test/data/test_file_01.txt',
          },
        ]
      )

      const outputs = [{ owner: USER_BOB_TOKEN, metadataFile: './test/data/test_file_04.txt' }]
      const actualResult = await addItemRoute(app, authToken, [lastTokenId + 1], outputs)

      expect(actualResult.status).to.equal(200)
      expect(actualResult.body).to.deep.equal(expectedResult)

      let item = await getItemRoute(app, authToken, { id: lastTokenId + 1 })

      expectedResult = {
        id: lastTokenId + 1,
        creator: USER_ALICE_TOKEN,
        owner: USER_ALICE_TOKEN,
        parents: [],
        children: [lastTokenId + 2],
      }

      assertItem(item.body, expectedResult)

      const itemNew = await getItemRoute(app, authToken, { id: lastTokenId + 2 })

      expectedResult = {
        id: lastTokenId + 2,
        creator: USER_ALICE_TOKEN,
        owner: USER_BOB_TOKEN,
        parents: [lastTokenId + 1],
        children: null,
      }

      assertItem(itemNew.body, expectedResult)
    })
  })
})
