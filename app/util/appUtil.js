const fs = require('fs')
const StreamValues = require('stream-json/streamers/StreamValues')
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = require('base-x')(BASE58)

const fetch = require('node-fetch')
const FormData = require('form-data')
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')

const { API_HOST, API_PORT, USER_URI, IPFS_HOST, IPFS_PORT, METADATA_KEY_LENGTH } = require('../env')
const logger = require('../logger')

const provider = new WsProvider(`ws://${API_HOST}:${API_PORT}`)
const metadata = {
  provider,
  types: {
    Address: 'MultiAddress',
    LookupSource: 'MultiAddress',
    PeerId: '(Vec<u8>)',
    TokenId: 'u128',
    TokenMetadataKey: `[u8; ${METADATA_KEY_LENGTH}]`,
    TokenMetadataValue: 'Hash',
    Token: {
      id: 'TokenId',
      owner: 'AccountId',
      creator: 'AccountId',
      created_at: 'BlockNumber',
      destroyed_at: 'Option<BlockNumber>',
      metadata: 'BTreeMap<TokenMetadataKey, TokenMetadataValue>',
      parents: 'Vec<TokenId>',
      children: 'Option<Vec<TokenId>>',
    },
  },
}

const api = new ApiPromise(metadata)

api.on('disconnected', () => {
  logger.warn(`Disconnected from substrate node at ${API_HOST}:${API_PORT}`)
})

api.on('connected', () => {
  logger.info(`Connected to substrate node at ${API_HOST}:${API_PORT}`)
})

api.on('error', (err) => {
  logger.error(`Error from substrate node connection. Error was ${err.message || JSON.stringify(err)}`)
})

async function addFile(file) {
  const form = new FormData()
  form.append('file', fs.createReadStream(file.path), file.name)
  const body = await fetch(`http://${IPFS_HOST}:${IPFS_PORT}/api/v0/add?cid-version=0&wrap-with-directory=true`, {
    method: 'POST',
    body: form,
  })

  // Build string of objects into array
  const text = await body.text()
  const json = text
    .split('\n')
    .filter((obj) => obj.length > 0)
    .map((obj) => JSON.parse(obj))

  return json
}

function formatHash(filestoreResponse) {
  // directory has no Name
  const dir = filestoreResponse.find((r) => r.Name === '')
  if (dir && dir.Hash && dir.Size) {
    const decoded = bs58.decode(dir.Hash)
    return `0x${decoded.toString('hex').slice(4)}`
  }
}

async function processMetadata(metadata, files) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(metadata).map(async ([key, filename]) => {
        if (key.length > METADATA_KEY_LENGTH)
          throw new Error(`Key: ${key} is too long. Maximum key length is ${METADATA_KEY_LENGTH}`)

        const file = files[filename]
        if (!file) throw new Error(`Error no attached file found for ${filename}`)
        const filestoreResponse = await addFile(file)
        return [key, formatHash(filestoreResponse)]
      })
    )
  )
}

const downloadFile = async (dirHash) => {
  const dirUrl = `http://${IPFS_HOST}:${IPFS_PORT}/api/v0/ls?arg=${dirHash}`
  const dirRes = await fetch(dirUrl, { method: 'POST' })
  if (!dirRes.ok) throw new Error(`Error fetching directory from IPFS (${dirRes.status}): ${await dirRes.text()}`)

  // Parse stream of dir data to get the file hash
  const pipeline = dirRes.body.pipe(StreamValues.withParser())
  const { fileHash, filename } = await new Promise((resolve, reject) =>
    pipeline
      .on('error', (err) => reject(err))
      .on('data', (data) => {
        if (data.value.Objects[0].Links.length > 0) {
          resolve({ fileHash: data.value.Objects[0].Links[0].Hash, filename: data.value.Objects[0].Links[0].Name })
        } else {
          // no links means it's just a file (legacy), not a directory
          resolve({ fileHash: dirHash, filename: 'metadata' })
        }
      })
  )

  // Return file
  const fileUrl = `http://${IPFS_HOST}:${IPFS_PORT}/api/v0/cat?arg=${fileHash}`
  const fileRes = await fetch(fileUrl, { method: 'POST' })
  if (!fileRes.ok) throw new Error(`Error fetching file from IPFS (${fileRes.status}): ${await fileRes.text()}`)

  return { file: fileRes.body, filename }
}

async function getLastTokenId() {
  await api.isReady
  const lastTokenId = await api.query.simpleNftModule.lastToken()

  return lastTokenId ? parseInt(lastTokenId, 10) : 0
}

async function runProcess(inputs, outputs) {
  if (inputs && outputs) {
    await api.isReady
    const keyring = new Keyring({ type: 'sr25519' })
    const alice = keyring.addFromUri(USER_URI)

    // [owner: 'OWNER_ID', metadata: METADATA_OBJ] -> ['OWNER_ID', METADATA_OBJ]
    const outputsAsPair = outputs.map(({ owner, metadata: md }) => [owner, md])
    logger.debug('Running Transaction inputs: %j outputs: %j', inputs, outputsAsPair)
    return new Promise((resolve) => {
      let unsub = null
      api.tx.simpleNftModule
        .runProcess(inputs, outputsAsPair)
        .signAndSend(alice, (result) => {
          logger.debug('result.status %s', JSON.stringify(result.status))
          logger.debug('result.status.isInBlock', result.status.isInBlock)
          if (result.status.isInBlock) {
            const tokens = result.events
              .filter(({ event: { method } }) => method === 'Minted')
              .map(({ event: { data } }) => data[0].toNumber())

            unsub()
            resolve(tokens)
          }
        })
        .then((res) => {
          unsub = res
        })
    })
  }

  return new Error('An error occurred whilst adding an item.')
}

async function getItem(tokenId) {
  let response = {}

  if (tokenId) {
    await api.isReady
    const item = await api.query.simpleNftModule.tokensById(tokenId)

    // TODO replace...
    response = JSON.parse(item)
  }

  return response
}

async function getMetadata(base64Hash) {
  // strip 0x and parse to base58
  const base58Hash = bs58.encode(Buffer.from(`1220${base64Hash.slice(2)}`, 'hex'))
  return downloadFile(base58Hash)
}

const getReadableMetadataKeys = (metadata) => {
  return Object.keys(metadata).map((key) => {
    return Buffer.from(key.slice(2), 'hex').toString('utf8').replace(/\0/g, '') // keys are fixed length so remove padding
  })
}

const validateTokenIds = async (ids) => {
  return await ids.reduce(async (acc, inputId) => {
    const uptoNow = await acc
    if (!uptoNow || !inputId || !Number.isInteger(inputId)) return false
    const { id: echoId, children } = await getItem(inputId)
    return children === null && echoId === inputId
  }, Promise.resolve(true))
}

module.exports = {
  runProcess,
  getItem,
  getLastTokenId,
  processMetadata,
  getMetadata,
  validateTokenIds,
  getReadableMetadataKeys,
}
