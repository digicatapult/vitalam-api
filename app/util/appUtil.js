const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = require('base-x')(BASE58)
const fs = require('fs')

const fetch = require('node-fetch')
const FormData = require('form-data')
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api')

const { API_HOST, API_PORT, USER_URI, IPFS_HOST, IPFS_PORT } = require('../env')
const logger = require('../logger')

const provider = new WsProvider(`ws://${API_HOST}:${API_PORT}`)
const metadata = {
  provider,
  types: {
    Address: 'MultiAddress',
    LookupSource: 'MultiAddress',
    TokenId: 'u128',
    TokenMetadata: 'Hash',
    Token: {
      id: 'TokenId',
      owner: 'AccountId',
      creator: 'AccountId',
      created_at: 'BlockNumber',
      destroyed_at: 'Option<BlockNumber>',
      metadata: 'TokenMetadata',
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
  form.append('file', fs.createReadStream(file))
  const body = await fetch(`http://${IPFS_HOST}:${IPFS_PORT}/api/v0/add?cid-version=0`, {
    method: 'POST',
    body: form,
  })
  return body.json()
}

async function processMetadata(file) {
  if (file) {
    const response = await addFile(file)
    if (response && response.Hash && response.Name && response.Size) {
      const decoded = bs58.decode(response.Hash)
      return `0x${decoded.toString('hex').slice(4)}`
    }
  }

  return null
}

const downloadFile = async (hash) => {
  const url = `http://${IPFS_HOST}:${IPFS_PORT}/api/v0/cat?arg=${hash}`
  const res = await fetch(url, { method: 'POST' })

  if (!res.ok) {
    throw new Error(`Error fetching file from IPFS (${res.status}): ${await res.text()}`)
  }

  return res.body
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

module.exports = {
  runProcess,
  getItem,
  getLastTokenId,
  processMetadata,
  getMetadata,
}
