const createJWKSMock = require('mock-jwks').default
const { describe, test, before, after, afterEach } = require('mocha')
const { expect } = require('chai')
const nock = require('nock')
const moment = require('moment')
const sinon = require('sinon')

const { createHttpServer } = require('../../app/server')
const {
  healthCheck,
  postRunProcess,
  postRunProcessWithProcess,
  postRunProcessNoFileAttach,
  getItemRoute,
  getItemMetadataRoute,
  getLastTokenIdRoute,
  addFileRoute,
  getMembersRoute,
} = require('../helper/routeHelper')
const { withNewTestProcess } = require('../helper/substrateHelper')
const USER_ALICE_TOKEN = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
const USER_BOB_TOKEN = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'
const USER_CHARLIE_TOKEN = '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y'
const NON_MEMBER_TOKEN = '5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY'
const { assertItem } = require('../helper/appHelper')
const { runProcess, utf8ToHex, indexToRole, getMaxMetadataCount } = require('../../app/util/appUtil')
const {
  AUTH_ISSUER,
  AUTH_AUDIENCE,
  METADATA_KEY_LENGTH,
  METADATA_VALUE_LITERAL_LENGTH,
  PROCESS_IDENTIFIER_LENGTH,
  IPFS_HOST,
  IPFS_PORT,
  AUTH_TYPE,
} = require('../../app/env')

const { responses: healthcheckResponses } = require('../helper/healthcheckFixtures')

const { substrateApi } = require('../../app/util/substrateApi')

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = require('base-x')(BASE58)

const describeAuthOnly = AUTH_TYPE === 'JWT' ? describe : describe.skip
const describeNoAuthOnly = AUTH_TYPE === 'NONE' ? describe : describe.skip

describe('routes', function () {
  before(async () => {
    nock.disableNetConnect()
    nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'))
  })

  afterEach(() => {
    nock.abortPendingRequests()
    nock.cleanAll()
  })

  let defaultRole
  before(async () => {
    defaultRole = { [await indexToRole(0)]: USER_ALICE_TOKEN }
  })

  describe('health check', function () {
    describe('happy path', function () {
      let app, statusHandler

      before(async function () {
        const server = await createHttpServer()
        app = server.app
        statusHandler = server.statusHandler
      })

      after(function () {
        statusHandler.close()
      })

      test('health check', async function () {
        const response = healthcheckResponses.ok
        const actualResult = await healthCheck(app)
        expect(actualResult.status).to.equal(response.code)
        expect(actualResult.body).to.deep.equal(response.body)
      })
    })

    describe('substrate service down', function () {
      let app, statusHandler

      before(function () {
        this.stubs = [
          sinon.stub(substrateApi, 'isReadyOrError').get(() => Promise.reject()),
          sinon.stub(substrateApi, 'isConnected').get(() => false),
        ]
      })

      after(function () {
        for (const stub of this.stubs) {
          stub.restore()
        }
      })

      before(async function () {
        const server = await createHttpServer()
        app = server.app
        statusHandler = server.statusHandler
      })

      after(function () {
        statusHandler.close()
      })

      test('service down', async function () {
        const response = healthcheckResponses.substrateDown
        const actualResult = await healthCheck(app)
        expect(actualResult.status).to.equal(response.code)
        expect(actualResult.body).to.deep.equal(response.body)
      })
    })

    describe('substrate service down then up', function () {
      let app, statusHandler

      before(function () {
        this.clock = sinon.useFakeTimers()
        this.stubs = [
          sinon.stub(substrateApi, 'isReadyOrError').get(() => Promise.reject()),
          sinon
            .stub(substrateApi, 'isConnected')
            .onFirstCall()
            .get(() => false)
            .onSecondCall()
            .get(() => true),
        ]
      })

      after(function () {
        for (const stub of this.stubs) {
          stub.restore()
        }
        this.clock.restore()
      })

      before(async function () {
        const server = await createHttpServer()
        app = server.app
        statusHandler = server.statusHandler
      })

      after(function () {
        statusHandler.close()
      })

      test('service up', async function () {
        const response = healthcheckResponses.ok
        const actualResult = await healthCheck(app)
        expect(actualResult.status).to.equal(response.code)
        expect(actualResult.body).to.deep.equal(response.body)
      })
    })

    describe('ipfs service down', function () {
      let app, statusHandler

      before(function () {
        nock.disableNetConnect()
        nock.enableNetConnect((host) => {
          return host !== `${IPFS_HOST}:${IPFS_PORT}`
        })
      })

      after(function () {
        nock.cleanAll()
        nock.enableNetConnect()
      })

      before(async function () {
        const server = await createHttpServer()
        app = server.app
        statusHandler = server.statusHandler
      })

      after(function () {
        statusHandler.close()
      })

      test('service down', async function () {
        const response = healthcheckResponses.ipfsDown
        const actualResult = await healthCheck(app)
        expect(actualResult.status).to.equal(response.code)
        expect(actualResult.body).to.deep.equal(response.body)
      })
    })

    describe('ipfs service no peers', function () {
      let app, statusHandler

      before(function () {
        nock(`http://${IPFS_HOST}:${IPFS_PORT}`)
          .post('/api/v0/version')
          .reply(200, { Version: '0.12.2' })
          .post('/api/v0/swarm/peers')
          .reply(200, { Peers: null })
      })

      after(function () {
        nock.cleanAll()
      })

      before(async function () {
        const server = await createHttpServer()
        app = server.app
        statusHandler = server.statusHandler
      })

      after(function () {
        statusHandler.close()
      })

      test('service down', async function () {
        const response = healthcheckResponses.ipfsDownNoPeers
        const actualResult = await healthCheck(app)
        expect(actualResult.status).to.equal(response.code)
        expect(actualResult.body).to.deep.equal(response.body)
      })
    })

    describe('ipfs service slow response', function () {
      let app, statusHandler

      before(function () {
        nock(`http://${IPFS_HOST}:${IPFS_PORT}`)
          .post('/api/v0/version')
          .delayBody(2000) // 2 seconds
          .reply(200, { Version: '0.12.2' })
          .post('/api/v0/swarm/peers')
          .reply(200, { Peers: [{ Peer: '1' }] })
      })

      after(function () {
        nock.cleanAll()
      })

      before(async function () {
        const server = await createHttpServer()
        app = server.app
        statusHandler = server.statusHandler
      })

      after(function () {
        statusHandler.close()
      })

      test('service down', async function () {
        const response = healthcheckResponses.ipfsDownTimeout
        const actualResult = await healthCheck(app)
        expect(actualResult.status).to.equal(response.code)
        expect(actualResult.body).to.deep.equal(response.body)
      })
    })
  })

  describeAuthOnly('authenticated', function () {
    let app
    let jwksMock
    let authToken
    let statusHandler
    const process = {}

    before(async function () {
      const server = await createHttpServer()
      app = server.app
      statusHandler = server.statusHandler

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

    after(function () {
      statusHandler.close()
    })

    withNewTestProcess(process)

    describe('happy path', function () {
      test('add and get item - single metadata FILE', async function () {
        const outputs = [
          { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
        ]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body).to.have.length(1)
        expect(runProcessResult.status).to.equal(200)
        const lastToken = await getLastTokenIdRoute(app, authToken)
        expect(lastToken.body).to.have.property('id')

        const getItemResult = await getItemRoute(app, authToken, lastToken.body)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(lastToken.body.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['testFile'])
        expect(moment(getItemResult.body.timestamp, moment.ISO_8601, true).isValid()).to.be.true
      })

      test('add item that consumes a parent', async function () {
        // add parent to be consumed
        const firstToken = await postRunProcess(app, authToken, [], [{ roles: defaultRole, metadata: {} }])
        expect(firstToken.status).to.equal(200)
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const firstTokenId = lastToken.body.id

        // add new token that will consume
        const inputs = [firstTokenId]
        const outputs = [{ roles: defaultRole, metadata: {}, parent_index: 0 }]
        const secondToken = await postRunProcess(app, authToken, inputs, outputs)

        expect(secondToken.body).to.have.length(1)
        expect(secondToken.status).to.equal(200)

        const getItemResult = await getItemRoute(app, authToken, { id: firstTokenId + 1 })
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(firstTokenId + 1)
        expect(getItemResult.body.original_id).to.equal(firstTokenId)
      })

      test('add and get item - single metadata LITERAL', async function () {
        const outputs = [{ roles: defaultRole, metadata: { testLiteral: { type: 'LITERAL', value: 'notAFile' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body).to.have.length(1)
        expect(runProcessResult.status).to.equal(200)

        const lastToken = await getLastTokenIdRoute(app, authToken)
        expect(lastToken.body).to.have.property('id')

        const getItemResult = await getItemRoute(app, authToken, lastToken.body)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(lastToken.body.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['testLiteral'])
      })

      test('add and get item - single metadata TOKEN_ID', async function () {
        const outputs = [{ roles: defaultRole, metadata: { testTokenId: { type: 'TOKEN_ID', value: '1' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body).to.have.length(1)
        expect(runProcessResult.status).to.equal(200)

        const lastToken = await getLastTokenIdRoute(app, authToken)
        expect(lastToken.body).to.have.property('id')

        const getItemResult = await getItemRoute(app, authToken, lastToken.body)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(lastToken.body.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['testTokenId'])
      })

      test('add and get item - single NONE', async function () {
        const outputs = [{ roles: defaultRole, metadata: { testNone: { type: 'NONE' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body).to.have.length(1)
        expect(runProcessResult.status).to.equal(200)

        const lastToken = await getLastTokenIdRoute(app, authToken)
        expect(lastToken.body).to.have.property('id')

        const getItemResult = await getItemRoute(app, authToken, lastToken.body)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(lastToken.body.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['testNone'])
      })

      test('add and get item metadata - FILE + LITERAL + TOKEN_ID + NONE', async function () {
        const outputs = [
          {
            roles: defaultRole,
            metadata: {
              testFile: { type: 'FILE', value: './test/data/test_file_01.txt' },
              testLiteral: { type: 'LITERAL', value: 'notAFile' },
              testTokenId: { type: 'TOKEN_ID', value: '42' },
              testNone: { type: 'NONE' },
            },
          },
        ]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body).to.have.length(1)
        expect(runProcessResult.status).to.equal(200)

        const lastToken = await getLastTokenIdRoute(app, authToken)
        expect(lastToken.body).to.have.property('id')

        const getItemResult = await getItemRoute(app, authToken, lastToken.body)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(lastToken.body.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['testFile', 'testLiteral', 'testNone', 'testTokenId'])

        const testFile = await getItemMetadataRoute(app, authToken, {
          id: lastToken.body.id,
          metadataKey: 'testFile',
        })
        expect(testFile.body.toString('utf8')).equal('This is the first test file...\n')
        expect(testFile.header['content-disposition']).equal('attachment; filename="test_file_01.txt"')
        expect(testFile.header['content-type']).equal('application/octet-stream')

        const testLiteral = await getItemMetadataRoute(app, authToken, {
          id: lastToken.body.id,
          metadataKey: 'testLiteral',
        })

        expect(testLiteral.text).equal('notAFile')
        expect(testLiteral.header['content-type']).equal('text/plain; charset=utf-8')

        const testTokenId = await getItemMetadataRoute(app, authToken, {
          id: lastToken.body.id,
          metadataKey: 'testTokenId',
        })

        expect(testTokenId.text).equal('42')
        expect(testTokenId.header['content-type']).equal('text/plain; charset=utf-8')

        const testNone = await getItemMetadataRoute(app, authToken, {
          id: lastToken.body.id,
          metadataKey: 'testNone',
        })

        expect(testNone.text).to.equal('')
        expect(testNone.header['content-type']).equal('text/plain; charset=utf-8')
      })

      test('add and get item - multiple FILE', async function () {
        const outputs = [
          {
            roles: defaultRole,
            metadata: {
              testFile1: { type: 'FILE', value: './test/data/test_file_01.txt' },
              testFile2: { type: 'FILE', value: './test/data/test_file_02.txt' },
            },
          },
        ]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body).to.have.length(1)
        expect(runProcessResult.status).to.equal(200)

        const lastToken = await getLastTokenIdRoute(app, authToken)
        expect(lastToken.body).to.have.property('id')

        const getItemResult = await getItemRoute(app, authToken, lastToken.body)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(lastToken.body.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['testFile1', 'testFile2'])
      })

      test('add and get item - multiple LITERAL', async function () {
        const outputs = [
          {
            roles: defaultRole,
            metadata: {
              testLiteral1: { type: 'LITERAL', value: 'test1' },
              testLiteral2: { type: 'LITERAL', value: 'test2' },
            },
          },
        ]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body).to.have.length(1)
        expect(runProcessResult.status).to.equal(200)

        const lastToken = await getLastTokenIdRoute(app, authToken)
        expect(lastToken.body).to.have.property('id')

        const getItemResult = await getItemRoute(app, authToken, lastToken.body)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(lastToken.body.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['testLiteral1', 'testLiteral2'])
      })

      test('add and get item - multiple TOKEN_ID', async function () {
        const outputs = [
          {
            roles: defaultRole,
            metadata: {
              testTokenId1: { type: 'TOKEN_ID', value: '42' },
              testTokenId2: { type: 'TOKEN_ID', value: '43' },
            },
          },
        ]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body).to.have.length(1)
        expect(runProcessResult.status).to.equal(200)

        const lastToken = await getLastTokenIdRoute(app, authToken)
        expect(lastToken.body).to.have.property('id')

        const getItemResult = await getItemRoute(app, authToken, lastToken.body)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(lastToken.body.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['testTokenId1', 'testTokenId2'])
      })

      // covers bug in polkadotjs/api@<5.2.1 that caused an error when encoding a BTreeMap with non-ascending keys
      test('add item - non-ascending keys', async function () {
        const outputs = [
          {
            roles: defaultRole,
            metadata: {
              3: { type: 'NONE' },
              2: { type: 'NONE' },
              1: { type: 'NONE' },
            },
          },
        ]

        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body).to.have.length(1)
        expect(runProcessResult.status).to.equal(200)

        const lastToken = await getLastTokenIdRoute(app, authToken)
        expect(lastToken.body).to.have.property('id')

        const getItemResult = await getItemRoute(app, authToken, lastToken.body)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(lastToken.body.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['1', '2', '3'])
      })

      test('get item metadata - direct add file', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id
        const dir = await addFileRoute('./test/data/test_file_01.txt')
        const { Hash: base58Metadata } = dir.find((r) => r.Name === '')

        const base64Metadata = `0x${bs58.decode(base58Metadata).toString('hex').slice(4)}`

        const key = utf8ToHex('testFile', METADATA_KEY_LENGTH)
        const output = { roles: new Map([[0, USER_ALICE_TOKEN]]), metadata: new Map([[key, { File: base64Metadata }]]) }

        await runProcess(null, [], [output])

        await getItemRoute(app, authToken, { id: lastToken.body.id + 1 })

        const res = await getItemMetadataRoute(app, authToken, { id: lastTokenId + 1, metadataKey: 'testFile' })

        expect(res.body.toString('utf8')).equal('This is the first test file...\n')
        expect(res.header['content-disposition']).equal('attachment; filename="test_file_01.txt"')
        expect(res.header['content-type']).equal('application/octet-stream')
      })

      test('run-process creating one token', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id

        let expectedResult = [lastTokenId + 1]

        const outputs = [
          { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
        ]
        const actualResult = await postRunProcess(app, authToken, [], outputs)

        expect(actualResult.status).to.equal(200)
        expect(actualResult.body).to.deep.equal(expectedResult)

        const item = await getItemRoute(app, authToken, { id: lastTokenId + 1 })

        expectedResult = {
          id: lastTokenId + 1,
          creator: USER_ALICE_TOKEN,
          roles: { [await indexToRole(0)]: USER_ALICE_TOKEN },
          parents: [],
          children: null,
          metadata_keys: ['testFile'],
        }
        assertItem(item.body, expectedResult)

        const itemMetadata = await getItemMetadataRoute(app, authToken, {
          id: lastTokenId + 1,
          metadataKey: 'testFile',
        })
        expect(itemMetadata.body.toString('utf8')).equal('This is the first test file...\n')
      })

      test('run-process destroying one token and creating one', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id

        let expectedResult = [lastTokenId + 2]

        await postRunProcess(
          app,
          authToken,
          [],
          [
            {
              roles: defaultRole,
              metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } },
            },
          ]
        )

        const outputs = [
          {
            roles: { [await indexToRole(0)]: USER_BOB_TOKEN },
            metadata: { testFile: { type: 'FILE', value: './test/data/test_file_04.txt' } },
          },
        ]
        const actualResult = await postRunProcess(app, authToken, [lastTokenId + 1], outputs)

        expect(actualResult.status).to.equal(200)
        expect(actualResult.body).to.deep.equal(expectedResult)

        let item = await getItemRoute(app, authToken, { id: lastTokenId + 1 })

        expectedResult = {
          id: lastTokenId + 1,
          creator: USER_ALICE_TOKEN,
          roles: { [await indexToRole(0)]: USER_ALICE_TOKEN },
          parents: [],
          children: [lastTokenId + 2],
          metadata_keys: ['testFile'],
        }

        assertItem(item.body, expectedResult)

        const itemNew = await getItemRoute(app, authToken, { id: lastTokenId + 2 })

        expectedResult = {
          id: lastTokenId + 2,
          creator: USER_ALICE_TOKEN,
          roles: { [await indexToRole(0)]: USER_BOB_TOKEN },
          parents: [lastTokenId + 1],
          children: null,
          metadata_keys: ['testFile'],
        }

        assertItem(itemNew.body, expectedResult)
      })

      test('return membership members', async function () {
        let expectedResult = [
          { address: USER_BOB_TOKEN },
          { address: USER_CHARLIE_TOKEN },
          { address: USER_ALICE_TOKEN },
        ]

        const res = await getMembersRoute(app, authToken)

        expect(res.body).deep.equal(expectedResult)
      })

      test('with named process', async function () {
        const outputs = [
          { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
        ]
        const runProcessResult = await postRunProcessWithProcess(app, authToken, process, [], outputs)

        expect(runProcessResult.status).to.equal(200)
        expect(runProcessResult.body).to.have.length(1)

        const tokenId = { id: runProcessResult.body[0] }

        const getItemResult = await getItemRoute(app, authToken, tokenId)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(tokenId.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['testFile'])
        expect(moment(getItemResult.body.timestamp, moment.ISO_8601, true).isValid()).to.be.true
      })
    })

    describe('invalid requests', function () {
      test('invalid bearer token', async function () {
        const result = await getLastTokenIdRoute(app, 'invalidToken')
        expect(result.status).to.equal(401)
      })

      test('add item - missing FILE attachments', async function () {
        const outputs = [
          { roles: defaultRole, metadata: { testFile1: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
        ]

        const runProcessResult = await postRunProcessNoFileAttach(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.contain('no attached file')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - metadataKey too long', async function () {
        const metadataKey = 'a'.repeat(METADATA_KEY_LENGTH + 1)
        const outputs = [{ roles: defaultRole, metadata: { [metadataKey]: { type: 'LITERAL', value: 'test' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.contain('too long')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - metadataKey too long (multibyte character)', async function () {
        const metadataKey = '£'.repeat(METADATA_KEY_LENGTH / 2 + 1)
        const outputs = [{ roles: defaultRole, metadata: { [metadataKey]: { type: 'LITERAL', value: 'test' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.contain('too long')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - invalid metadata type', async function () {
        const outputs = [{ roles: defaultRole, metadata: { testKey: { type: 'INVALID', value: 'test' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.contain('invalid type')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - null metadata', async function () {
        const outputs = [{ roles: defaultRole, metadata: { testKey: null } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.contain('invalid type')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - metadata FILE without value field', async function () {
        const outputs = [{ roles: defaultRole, metadata: { testKey: { type: 'FILE' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.equal('File metadata requires a value field')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - metadata LITERAL without value field', async function () {
        const outputs = [{ roles: defaultRole, metadata: { testKey: { type: 'LITERAL' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.equal('Literal metadata requires a value field')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - metadata TOKEN_ID without value field', async function () {
        const outputs = [{ roles: defaultRole, metadata: { testKey: { type: 'TOKEN_ID' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.equal('TokenId metadata requires a value field')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - metadata LITERAL value too long', async function () {
        const literalValue = 'a'.repeat(METADATA_VALUE_LITERAL_LENGTH + 1)
        const outputs = [{ roles: defaultRole, metadata: { testKey: { type: 'LITERAL', value: literalValue } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.contain('too long')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - metadata LITERAL value too long (multibyte character)', async function () {
        const literalValue = '£'.repeat(METADATA_VALUE_LITERAL_LENGTH / 2 + 1)
        const outputs = [{ roles: defaultRole, metadata: { testKey: { type: 'LITERAL', value: literalValue } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.contain('too long')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - metadata TOKEN_ID value is invalid tokenId', async function () {
        const invalidToken = 'notAToken'
        const outputs = [{ roles: defaultRole, metadata: { testKey: { type: 'TOKEN_ID', value: invalidToken } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.equal('Invalid metadata tokenId')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item - too many metadata items', async function () {
        const tooMany = {}
        const maxMetadataCount = await getMaxMetadataCount()
        for (let i = 0; i < maxMetadataCount + 1; i++) {
          tooMany[`${i}`] = { type: 'NONE' }
        }
        const outputs = [{ roles: defaultRole, metadata: tooMany }]

        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.body.message).to.contain('too many')
        expect(runProcessResult.status).to.equal(400)
      })

      test('add item with out of range index for parent', async function () {
        // add parent to be consumed
        const firstToken = await postRunProcess(app, authToken, [], [{ roles: defaultRole, metadata: {} }])
        expect(firstToken.status).to.equal(200)
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const firstTokenId = lastToken.body.id

        // add new token with out of range parent_index
        const inputs = [firstTokenId]
        const outputs = [{ roles: defaultRole, metadata: {}, parent_index: 99 }]
        const secondToken = await postRunProcess(app, authToken, inputs, outputs)

        expect(secondToken.body.message).to.equal('Parent index out of range')
        expect(secondToken.status).to.equal(400)
      })

      test('add item with parent_index < 0', async function () {
        // add parent to be consumed
        const firstToken = await postRunProcess(app, authToken, [], [{ roles: defaultRole, metadata: {} }])
        expect(firstToken.status).to.equal(200)
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const firstTokenId = lastToken.body.id

        // add new token with out of range parent_index
        const inputs = [firstTokenId]
        const outputs = [{ roles: defaultRole, metadata: {}, parent_index: -1 }]
        const secondToken = await postRunProcess(app, authToken, inputs, outputs)

        expect(secondToken.body.message).to.equal('Parent index out of range')
        expect(secondToken.status).to.equal(400)
      })

      test('add item with parent_index === inputs.length', async function () {
        // add parent to be consumed
        const firstToken = await postRunProcess(app, authToken, [], [{ roles: defaultRole, metadata: {} }])
        expect(firstToken.status).to.equal(200)
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const firstTokenId = lastToken.body.id

        // add new token with out of range parent_index
        const inputs = [firstTokenId]
        const outputs = [{ roles: defaultRole, metadata: {}, parent_index: 1 }]
        const secondToken = await postRunProcess(app, authToken, inputs, outputs)

        expect(secondToken.body.message).to.equal('Parent index out of range')
        expect(secondToken.status).to.equal(400)
      })

      test('add multiple items with same parent', async function () {
        // add parent to be consumed
        const firstToken = await postRunProcess(app, authToken, [], [{ roles: defaultRole, metadata: {} }])
        expect(firstToken.status).to.equal(200)
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const firstTokenId = lastToken.body.id

        // add new tokens with duplicate parent_index
        const inputs = [firstTokenId]
        const outputs = [
          { roles: defaultRole, metadata: {}, parent_index: 0 },
          { roles: defaultRole, metadata: {}, parent_index: 0 },
        ]
        const secondToken = await postRunProcess(app, authToken, inputs, outputs)

        expect(secondToken.body.message).to.equal('Duplicate parent index used')
        expect(secondToken.status).to.equal(400)
      })

      test('add item with parent but no inputs', async function () {
        // add new token with no inputs
        const inputs = []
        const outputs = [{ roles: defaultRole, metadata: {}, parent_index: 99 }]
        const secondToken = await postRunProcess(app, authToken, inputs, outputs)

        expect(secondToken.body.message).to.equal('Parent index out of range')
        expect(secondToken.status).to.equal(400)
      })

      test('get item - missing ID', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id
        const actualResult = await getItemRoute(app, authToken, { id: lastTokenId + 1000 })
        expect(actualResult.status).to.equal(404)
        expect(actualResult.body).to.have.property('message')
      })

      test('get item - invalid ID', async function () {
        const actualResult = await getItemRoute(app, authToken, { id: 0 })
        expect(actualResult.status).to.equal(400)
        expect(actualResult.body.message).to.contain('id')
      })

      test('get item metadata - missing ID', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id
        const actualResult = await getItemMetadataRoute(app, authToken, {
          id: lastTokenId + 1000,
        })

        expect(actualResult.status).to.equal(404)
        expect(actualResult.body).to.have.property('message')
      })

      test('get item metadata - missing metadataKey', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id
        const actualResult = await getItemMetadataRoute(app, authToken, {
          id: lastTokenId,
          metadataKey: 'missingKey',
        })

        expect(actualResult.status).to.equal(404)
        expect(actualResult.body).to.have.property('message')
      })

      test('get invalid item metadata', async function () {
        const actualResult = await getItemMetadataRoute(app, authToken, { id: 0 })

        expect(actualResult.body.message).to.contain('id')
        expect(actualResult.body).to.have.property('message')
      })

      test('run-process with invalid member', async function () {
        let expectedResult = { message: 'Request contains roles with account IDs not in the membership list' }

        const actualResult = await postRunProcess(
          app,
          authToken,
          [],
          [
            {
              roles: { [await indexToRole(0)]: NON_MEMBER_TOKEN },
              metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } },
            },
          ]
        )
        expect(actualResult.status).to.equal(400)
        expect(actualResult.body).to.deep.equal(expectedResult)
      })

      test('run-process destroying one token, failure to create another with invalid member', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id

        let expectedResult = { message: 'Request contains roles with account IDs not in the membership list' }

        await postRunProcess(
          app,
          authToken,
          [],
          [
            {
              roles: defaultRole,
              metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } },
            },
          ]
        )
        const outputs = [
          {
            roles: { [await indexToRole(0)]: NON_MEMBER_TOKEN },
            metadata: { testFile: { type: 'FILE', value: './test/data/test_file_04.txt' } },
          },
        ]
        const actualResult = await postRunProcess(app, authToken, [lastTokenId + 1], outputs)

        expect(actualResult.status).to.equal(400)
        expect(actualResult.body).to.deep.equal(expectedResult)
      })

      test('failure to destroy token with member not having correct role', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id
        const outputs = [
          {
            roles: { [await indexToRole(0)]: USER_BOB_TOKEN, [await indexToRole(1)]: USER_ALICE_TOKEN },
            metadata: { testNone: { type: 'NONE' } },
          },
        ]
        await postRunProcess(app, authToken, [], outputs)

        const actualResult = await postRunProcess(app, authToken, [lastTokenId + 1], outputs)

        expect(actualResult.status).to.equal(400)
        expect(actualResult.body).to.have.property('message')
        expect(actualResult.body.message).to.contain(lastTokenId + 1)
      })

      test('failure to burn a token twice', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id
        const outputs = [
          {
            roles: defaultRole,
            metadata: { testNone: { type: 'NONE' } },
          },
        ]
        await postRunProcess(app, authToken, [], outputs)

        const firstBurn = await postRunProcess(app, authToken, [lastTokenId + 1], outputs)
        expect(firstBurn.status).to.equal(200)

        const secondBurn = await postRunProcess(app, authToken, [lastTokenId + 1], outputs)
        expect(secondBurn.status).to.equal(400)
        expect(secondBurn.body).to.have.property('message')
        expect(secondBurn.body.message).to.contain(lastTokenId + 1)
      })

      test('add item - no roles', async function () {
        const outputs = [{ metadata: { testNone: { type: 'NONE' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.status).to.equal(400)
        expect(runProcessResult.body.message).to.contain('roles')
      })

      test('add item - no default role', async function () {
        const outputs = [
          { roles: { [await indexToRole(1)]: USER_ALICE_TOKEN }, metadata: { testNone: { type: 'NONE' } } },
        ]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.status).to.equal(400)
        expect(runProcessResult.body.message).to.contain('default')
      })

      test('add item - invalid role', async function () {
        const outputs = [
          {
            roles: { [await indexToRole(0)]: USER_ALICE_TOKEN, InvalidRole: USER_ALICE_TOKEN },
            metadata: { testNone: { type: 'NONE' } },
          },
        ]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.status).to.equal(400)
        expect(runProcessResult.body.message).to.contain('role')
      })

      test("process version that doesn't exist", async function () {
        const outputs = [
          { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
        ]
        const version = process.version + 1
        const runProcessResult = await postRunProcessWithProcess(
          app,
          authToken,
          {
            id: process.id,
            version,
          },
          [],
          outputs
        )

        expect(runProcessResult.status).to.equal(400)
        expect(runProcessResult.body.message).to.equal(`Process ${process.id} version ${version} does not exist`)
      })

      test("process name that doesn't exist", async function () {
        const outputs = [
          { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
        ]
        const runProcessResult = await postRunProcessWithProcess(
          app,
          authToken,
          {
            id: 'not-a-process',
            version: process.version,
          },
          [],
          outputs
        )

        expect(runProcessResult.status).to.equal(400)
        expect(runProcessResult.body.message).to.equal(
          `Process not-a-process version ${process.version} does not exist`
        )
      })

      test('process name that is too long', async function () {
        const outputs = [
          { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
        ]
        const id = Array(PROCESS_IDENTIFIER_LENGTH + 1)
          .fill('a')
          .join('')
        const runProcessResult = await postRunProcessWithProcess(
          app,
          authToken,
          {
            id,
            version: process.version,
          },
          [],
          outputs
        )

        expect(runProcessResult.status).to.equal(400)
        expect(runProcessResult.body.message).to.equal(`Invalid process id: ${id}`)
      })

      test("process version that isn't a number", async function () {
        const outputs = [
          { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
        ]
        const version = null
        const runProcessResult = await postRunProcessWithProcess(
          app,
          authToken,
          {
            id: process.id,
            version,
          },
          [],
          outputs
        )

        expect(runProcessResult.status).to.equal(400)
        expect(runProcessResult.body.message).to.equal(`Invalid process version: ${version}`)
      })

      test("process version that isn't an integer", async function () {
        const outputs = [
          { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
        ]
        const version = 3.14
        const runProcessResult = await postRunProcessWithProcess(
          app,
          authToken,
          {
            id: process.id,
            version,
          },
          [],
          outputs
        )

        expect(runProcessResult.status).to.equal(400)
        expect(runProcessResult.body.message).to.equal(`Invalid process version: ${version}`)
      })

      test("process version that isn't a 32bit integer", async function () {
        const outputs = [
          { roles: defaultRole, metadata: { testFile: { type: 'FILE', value: './test/data/test_file_01.txt' } } },
        ]
        const version = Number.MAX_SAFE_INTEGER
        const runProcessResult = await postRunProcessWithProcess(
          app,
          authToken,
          {
            id: process.id,
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

  describeNoAuthOnly('no auth', function () {
    let app
    let statusHandler
    const process = {}

    before(async function () {
      const server = await createHttpServer()
      app = server.app
      statusHandler = server.statusHandler
    })

    after(function () {
      statusHandler.close()
    })

    withNewTestProcess(process)

    describe('happy path', function () {
      test('add and get item metadata - FILE + LITERAL + TOKEN_ID + NONE', async function () {
        const outputs = [
          {
            roles: defaultRole,
            metadata: {
              testFile: { type: 'FILE', value: './test/data/test_file_01.txt' },
              testLiteral: { type: 'LITERAL', value: 'notAFile' },
              testTokenId: { type: 'TOKEN_ID', value: '42' },
              testNone: { type: 'NONE' },
            },
          },
        ]
        const runProcessResult = await postRunProcess(app, null, [], outputs)
        expect(runProcessResult.body).to.have.length(1)
        expect(runProcessResult.status).to.equal(200)

        const lastToken = await getLastTokenIdRoute(app, null)
        expect(lastToken.body).to.have.property('id')

        const getItemResult = await getItemRoute(app, null, lastToken.body)
        expect(getItemResult.status).to.equal(200)
        expect(getItemResult.body.id).to.equal(lastToken.body.id)
        expect(getItemResult.body.metadata_keys).to.deep.equal(['testFile', 'testLiteral', 'testNone', 'testTokenId'])

        const testFile = await getItemMetadataRoute(app, null, {
          id: lastToken.body.id,
          metadataKey: 'testFile',
        })
        expect(testFile.body.toString('utf8')).equal('This is the first test file...\n')
        expect(testFile.header['content-disposition']).equal('attachment; filename="test_file_01.txt"')
        expect(testFile.header['content-type']).equal('application/octet-stream')

        const testLiteral = await getItemMetadataRoute(app, null, {
          id: lastToken.body.id,
          metadataKey: 'testLiteral',
        })

        expect(testLiteral.text).equal('notAFile')
        expect(testLiteral.header['content-type']).equal('text/plain; charset=utf-8')

        const testTokenId = await getItemMetadataRoute(app, null, {
          id: lastToken.body.id,
          metadataKey: 'testTokenId',
        })

        expect(testTokenId.text).equal('42')
        expect(testTokenId.header['content-type']).equal('text/plain; charset=utf-8')

        const testNone = await getItemMetadataRoute(app, null, {
          id: lastToken.body.id,
          metadataKey: 'testNone',
        })

        expect(testNone.text).to.equal('')
        expect(testNone.header['content-type']).equal('text/plain; charset=utf-8')
      })

      test('return membership members', async function () {
        let expectedResult = [
          { address: USER_BOB_TOKEN },
          { address: USER_CHARLIE_TOKEN },
          { address: USER_ALICE_TOKEN },
        ]

        const res = await getMembersRoute(app, null)

        expect(res.body).deep.equal(expectedResult)
      })
    })
  })
})
