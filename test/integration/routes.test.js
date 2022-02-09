/* eslint-disable */
const createJWKSMock = require('mock-jwks').default
const { describe, test, before } = require('mocha')
const { expect } = require('chai')
const nock = require('nock')
const moment = require('moment')

const { createHttpServer } = require('../../app/server')
const {
  healthCheck,
  getAuthTokenRoute,
  postRunProcess,
  postRunProcessNoFileAttach,
  getItemRoute,
  getItemMetadataRoute,
  getItemMetadataRouteLegacy,
  getLastTokenIdRoute,
  addFileRoute,
  addFileRouteLegacy,
  getMembersRoute,
} = require('../helper/routeHelper')
const USER_ALICE_TOKEN = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
const ALICE_STASH = '5GNJqTPyNqANBkUVMN1LPPrxXnFouWXoe2wNSmmEoLctxiZY'
const USER_BOB_TOKEN = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'
const BOB_STASH = '5HpG9w8EBLe5XCrbczpwq5TSXvedjrBGCwqxK1iQ7qUsSWFc'
const USER_CHARLIE_TOKEN = '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y'
const { assertItem } = require('../helper/appHelper')
const { runProcess, utf8ToUint8Array, rolesEnum } = require('../../app/util/appUtil')
const {
  AUTH_TOKEN_URL,
  AUTH_ISSUER,
  AUTH_AUDIENCE,
  LEGACY_METADATA_KEY,
  METADATA_KEY_LENGTH,
  METADATA_VALUE_LITERAL_LENGTH,
  MAX_METADATA_COUNT,
  API_VERSION,
} = require('../../app/env')

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = require('base-x')(BASE58)
const defaultRole = { [rolesEnum[0]]: USER_ALICE_TOKEN }

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
      const expectedResult = { status: 'ok', version: API_VERSION }

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
      nock(AUTH_TOKEN_URL).post(`/`).reply(200, tokenResponse)
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
    const deniedResponse = { error: 'Unauthorised' }

    before(async () => {
      app = await createHttpServer()
      nock(AUTH_TOKEN_URL).post(`/`).reply(401, deniedResponse)
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

        const key = utf8ToUint8Array('testFile', METADATA_KEY_LENGTH)
        const output = { roles: new Map([[0, USER_ALICE_TOKEN]]), metadata: new Map([[key, { File: base64Metadata }]]) }

        await runProcess([], [output])

        const actualResult = await getItemRoute(app, authToken, { id: lastToken.body.id + 1 })

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
          roles: { [rolesEnum[0]]: USER_ALICE_TOKEN },
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
            roles: { [rolesEnum[0]]: USER_BOB_TOKEN },
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
          roles: { [rolesEnum[0]]: USER_ALICE_TOKEN },
          parents: [],
          children: [lastTokenId + 2],
          metadata_keys: ['testFile'],
        }

        assertItem(item.body, expectedResult)

        const itemNew = await getItemRoute(app, authToken, { id: lastTokenId + 2 })

        expectedResult = {
          id: lastTokenId + 2,
          creator: USER_ALICE_TOKEN,
          roles: { [rolesEnum[0]]: USER_BOB_TOKEN },
          parents: [lastTokenId + 1],
          children: null,
          metadata_keys: ['testFile'],
        }

        assertItem(itemNew.body, expectedResult)
      })

      test('return membership members', async function () {
        let expectedResult = [
          { address: USER_BOB_TOKEN },
          { address: ALICE_STASH },
          { address: USER_ALICE_TOKEN },
          { address: BOB_STASH },
        ]

        const res = await getMembersRoute(app, authToken)

        expect(res.body).deep.equal(expectedResult)
      })
    })

    describe('invalid requests', function () {
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
        for (let i = 0; i < MAX_METADATA_COUNT + 1; i++) {
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
              roles: { [rolesEnum[0]]: USER_CHARLIE_TOKEN },
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
            roles: { [rolesEnum[0]]: USER_CHARLIE_TOKEN },
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
            roles: { [rolesEnum[0]]: USER_BOB_TOKEN, [rolesEnum[1]]: USER_ALICE_TOKEN },
            metadata: { testNone: { type: 'NONE' } },
          },
        ]
        await postRunProcess(app, authToken, [], outputs)

        const ignoredOutputs = [
          {
            roles: defaultRole,
            metadata: { testNone: { type: 'NONE' } },
          },
        ]
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
        const outputs = [{ roles: { [rolesEnum[1]]: USER_ALICE_TOKEN }, metadata: { testNone: { type: 'NONE' } } }]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.status).to.equal(400)
        expect(runProcessResult.body.message).to.contain('default')
      })

      test('add item - invalid role', async function () {
        const outputs = [
          {
            roles: { [rolesEnum[0]]: USER_ALICE_TOKEN, InvalidRole: USER_ALICE_TOKEN },
            metadata: { testNone: { type: 'NONE' } },
          },
        ]
        const runProcessResult = await postRunProcess(app, authToken, [], outputs)
        expect(runProcessResult.status).to.equal(400)
        expect(runProcessResult.body.message).to.contain('role')
      })
    })

    describe('legacy', function () {
      test('run-process creating one token - legacy metadataFile + owner in request and metadata route', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id

        let expectedResult = [lastTokenId + 1]

        const outputs = [{ owner: USER_ALICE_TOKEN, metadataFile: './test/data/test_file_04.txt' }]
        const actualResult = await postRunProcess(app, authToken, [], outputs)

        expect(actualResult.status).to.equal(200)
        expect(actualResult.body).to.deep.equal(expectedResult)

        const item = await getItemRoute(app, authToken, { id: lastTokenId + 1 })

        expectedResult = {
          id: lastTokenId + 1,
          creator: USER_ALICE_TOKEN,
          roles: { [rolesEnum[0]]: USER_ALICE_TOKEN },
          parents: [],
          children: null,
          metadata_keys: [LEGACY_METADATA_KEY],
        }
        assertItem(item.body, expectedResult)

        const itemMetadata = await getItemMetadataRouteLegacy(app, authToken, {
          id: lastTokenId + 1,
        })
        expect(itemMetadata.body.toString('utf8')).equal('This is the fourth test file...\n')
      })

      test('get item metadata - direct add file (addFileRouteLegacy)', async function () {
        const lastToken = await getLastTokenIdRoute(app, authToken)
        const lastTokenId = lastToken.body.id
        const { Hash: base58Metadata } = await addFileRouteLegacy('./test/data/test_file_01.txt')
        const base64Metadata = `0x${bs58.decode(base58Metadata).toString('hex').slice(4)}`

        const key = utf8ToUint8Array('testFile', METADATA_KEY_LENGTH)
        const output = { roles: new Map([[0, USER_ALICE_TOKEN]]), metadata: new Map([[key, { File: base64Metadata }]]) }

        await runProcess([], [output])

        const res = await getItemMetadataRoute(app, authToken, { id: lastTokenId + 1, metadataKey: 'testFile' })

        expect(res.body.toString('utf8')).equal('This is the first test file...\n')
        expect(res.header['content-disposition']).equal('attachment; filename="metadata"')
        expect(res.header['content-type']).equal('application/octet-stream')
      })
    })
  })
})
