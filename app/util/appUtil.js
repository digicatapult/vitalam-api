const fs = require('fs')
const path = require('path')
const StreamValues = require('stream-json/streamers/StreamValues')
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = require('base-x')(BASE58)
const fetch = require('node-fetch')
const FormData = require('form-data')
const jwksRsa = require('jwks-rsa')
const { Keyring } = require('@polkadot/api')
const jwt = require('jsonwebtoken')
const {
  USER_URI,
  IPFS_HOST,
  IPFS_PORT,
  METADATA_KEY_LENGTH,
  METADATA_VALUE_LITERAL_LENGTH,
  MAX_METADATA_COUNT,
  AUTH_AUDIENCE,
  AUTH_JWKS_URI,
  AUTH_ISSUER,
  PROCESS_IDENTIFIER_LENGTH,
} = require('../env')
const logger = require('../logger')
const {
  substrateApi: api,
  types: {
    Role: { _enum: rolesEnum },
  },
} = require('./substrateApi')

async function addFile(file) {
  logger.debug('Uploading file %s', file.originalname)
  logger.trace('Temporary file is stored at path: %s', file.path)
  const form = new FormData()
  form.append('file', fs.createReadStream(file.path), file.originalname)
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

  const hash = formatHash(json)
  logger.debug('Upload of file %s succeeded. Hash is %s', file.originalname, hash)

  return hash
}

function formatHash(filestoreResponse) {
  // directory has no Name
  const dir = filestoreResponse.find((r) => r.Name === '')
  if (dir && dir.Hash && dir.Size) {
    const decoded = bs58.decode(dir.Hash)
    return `0x${decoded.toString('hex').slice(4)}`
  }
}

const processRoles = async (roles) => {
  const defaultRole = rolesEnum[0]
  if (!roles[defaultRole]) {
    throw new Error(`Roles must include default ${defaultRole} role. Roles: ${JSON.stringify(roles)}`)
  }

  if (await containsInvalidMembershipRoles(roles)) {
    throw new Error(`Request contains roles with account IDs not in the membership list`)
  }

  return new Map(
    Object.entries(roles).map(([key, v]) => {
      return [roleEnumAsIndex(key), v]
    })
  )
}

const validMetadataValueTypes = new Set(['LITERAL', 'TOKEN_ID', 'FILE', 'NONE'])
async function processMetadata(metadata, files) {
  const metadataItems = Object.entries(metadata)
  if (metadataItems.length > MAX_METADATA_COUNT)
    throw new Error(`Metadata has too many items: ${metadataItems.length}. Max item count: ${MAX_METADATA_COUNT}`)

  return new Map(
    await Promise.all(
      metadataItems.map(async ([key, value]) => {
        const keyAsUint8Array = utf8ToUint8Array(key, METADATA_KEY_LENGTH)

        if (typeof value !== 'object' || value === null || !validMetadataValueTypes.has(value.type)) {
          throw new Error(
            `Error invalid type in ${key}:${JSON.stringify(value)}. Must be one of ${Array.from(
              validMetadataValueTypes
            ).join(', ')}`
          )
        }

        switch (value.type) {
          case 'LITERAL':
            value = processLiteral(value)
            break
          case 'TOKEN_ID':
            value = processTokenId(value)
            break
          case 'FILE':
            value = await processFile(value, files)
            break
          default:
          case 'NONE':
            value = { None: null }
            break
        }

        return [keyAsUint8Array, value]
      })
    )
  )
}

const processLiteral = (value) => {
  const literalValue = value.value
  if (!literalValue) throw new Error(`Literal metadata requires a value field`)

  const valueAsUint8Array = utf8ToUint8Array(literalValue, METADATA_VALUE_LITERAL_LENGTH)
  return { Literal: valueAsUint8Array }
}

const processTokenId = (value) => {
  if (!value.value) throw new Error(`TokenId metadata requires a value field`)

  const tokenId = validateTokenId(value.value)
  if (!tokenId) throw new Error(`Invalid metadata tokenId`)

  return { TokenId: tokenId }
}

const processFile = async (value, files) => {
  if (!value.value) throw new Error(`File metadata requires a value field`)

  const filePath = value.value
  const file = files.find((f) => {
    return f.originalname === path.basename(filePath)
  })
  if (!file) throw new Error(`Error no attached file found for ${filePath}`)

  const filestoreResponse = await addFile(file)
  return { File: filestoreResponse }
}

const validateProcess = async (id, version) => {
  await api.isReady

  const processId = utf8ToHex(id, PROCESS_IDENTIFIER_LENGTH)
  const process = await api.query.processValidation.processModel(processId, version)
  const processVersion = await api.query.processValidation.versionModel(processId)

  // check if process is valid
  if (processVersion < version) {
    throw new Error(`Process ${id} version ${version} does not exist`)
  } else if (!process.status.isEnabled) {
    throw new Error(`Process ${id} version ${version} has been disabled`)
  }

  return {
    id: processId,
    version,
  }
}

const utf8ToUint8Array = (str, len) => {
  const arr = new Uint8Array(len)
  try {
    arr.set(Buffer.from(str, 'utf8'))
  } catch (err) {
    if (err instanceof RangeError) {
      throw new Error(`${str} is too long. Max length: ${len} bytes`)
    } else throw err
  }
  return arr
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

async function containsInvalidMembershipRoles(roles) {
  const membershipMembers = await getMembers()

  const accountIds = Object.values(roles)
  const validMembers = accountIds.reduce((acc, accountId) => {
    if (membershipMembers.includes(accountId)) {
      acc.push(accountId)
      return acc
    }
  }, [])

  return !validMembers || validMembers.length === 0 || validMembers.length !== accountIds.length
}

function membershipReducer(members) {
  return members.reduce((acc, item) => {
    acc.push({ address: item })
    return acc
  }, [])
}

async function getMembers() {
  await api.isReady

  return api.query.membership.members()
}

async function runProcess(process, inputs, outputs) {
  if (inputs && outputs) {
    await api.isReady
    const keyring = new Keyring({ type: 'sr25519' })
    const alice = keyring.addFromUri(USER_URI)

    const relevantOutputs = outputs.map(({ roles, metadata, parent_index }) => [roles, metadata, parent_index])
    logger.debug('Running Transaction inputs: %j outputs: %j', inputs, relevantOutputs)
    return new Promise((resolve, reject) => {
      let unsub = null
      api.tx.simpleNftModule
        .runProcess(process, inputs, relevantOutputs)
        .signAndSend(alice, (result) => {
          logger.debug('result.status %s', JSON.stringify(result.status))
          logger.debug('result.status.isInBlock', result.status.isInBlock)
          if (result.status.isInBlock) {
            const errors = result.events
              .filter(({ event: { method } }) => method === 'ExtrinsicFailed')
              .map(({ event: { data } }) => data[0])

            if (errors.length > 0) {
              reject('ExtrinsicFailed error in simpleNftModule')
            }

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
        .catch((err) => {
          logger.warn(`Error in run process transaction: ${err}`)
          throw err
        })
    })
  }

  return new Error('An error occurred whilst adding an item.')
}

const getItemMetadataSingle = async (tokenId, metadataKey) => {
  const { metadata, id } = await getItem(tokenId)
  if (id !== tokenId) throw new Error(`Id not found: ${tokenId}`)

  const metadataValue = metadata[utf8ToHex(metadataKey, METADATA_KEY_LENGTH)]

  if (!metadataValue) {
    throw new Error(`No metadata with key '${metadataKey}' for token with ID: ${tokenId}`)
  }
  return metadataValue
}

async function getItem(tokenId) {
  let response = {}

  if (tokenId) {
    await api.isReady
    const item = (await api.query.simpleNftModule.tokensById(tokenId)).toJSON()
    const timestamp = await getTimestamp(item.created_at)

    response = { ...item, timestamp }
  }

  return response
}

async function getTimestamp(blockNumber) {
  await api.isReady
  const hash = await api.rpc.chain.getBlockHash(blockNumber)
  const block = await api.rpc.chain.getBlock(hash)

  const extrinsics = block.block.extrinsics.toHuman()
  const timestampEx = extrinsics.find(({ method: { section } }) => section === 'timestamp')

  if (!timestampEx) return null

  const {
    method: { args: rawTimestamp },
  } = timestampEx

  const unix = parseInt(rawTimestamp[0].replace(/,/g, '')) // convert from e.g. [ '1,644,402,612,003' ]
  const timestamp = new Date(unix).toISOString()

  return timestamp
}

async function getFile(base64Hash) {
  // strip 0x and parse to base58
  const base58Hash = bs58.encode(Buffer.from(`1220${base64Hash.slice(2)}`, 'hex'))
  return downloadFile(base58Hash)
}

const utf8ToHex = (str, len) => {
  const buffer = Buffer.alloc(len)
  buffer.write(str)
  return `0x${buffer.toString('hex')}`
}

const hexToUtf8 = (str) => {
  return Buffer.from(str.slice(2), 'hex').toString('utf8').replace(/\0/g, '') // remove padding
}

const getReadableMetadataKeys = (metadata) => {
  return Object.keys(metadata).map((key) => {
    return hexToUtf8(key)
  })
}

const validateInputIds = async (accountIds) => {
  await api.isReady
  const keyring = new Keyring({ type: 'sr25519' })
  const userId = keyring.addFromUri(USER_URI).address

  return await accountIds.reduce(async (acc, id) => {
    const uptoNow = await acc
    if (!uptoNow || !id || !Number.isInteger(id)) return false

    const { roles, id: echoId, children } = await getItem(id)
    const defaultRole = rolesEnum[0]
    if (roles[defaultRole] !== userId) return false

    return children === null && echoId === id
  }, Promise.resolve(true))
}

const validateTokenId = (tokenId) => {
  let id
  try {
    id = parseInt(tokenId, 10)
  } catch (err) {
    logger.error(`Error parsing tokenId. Error was ${err.message || JSON.stringify(err)}`)
    return null
  }

  if (!Number.isInteger(id) || id === 0) return null

  return id
}

const roleEnumAsIndex = (role) => {
  const index = rolesEnum.indexOf(role)

  if (index === -1) {
    throw new Error(`Invalid role: ${role}`)
  }

  return index
}

const getMetadataResponse = async (tokenId, metadataKey, res) => {
  const id = validateTokenId(tokenId)

  if (!id) {
    logger.trace(`Invalid id: ${tokenId}`)
    res.status(400).json({ message: `Invalid id: ${tokenId}` })
    return
  }

  let metadataValue
  try {
    metadataValue = await getItemMetadataSingle(id, metadataKey)
  } catch (err) {
    logger.trace(`Invalid metadata request: ${err.message}`)
    res.status(404).json({ message: err.message })
    return
  }

  if (metadataValue.file) {
    let file
    try {
      file = await getFile(metadataValue.file)
    } catch (err) {
      logger.warn(`Error fetching metadata file: ${metadataValue.file}. Error was ${err}`)
      res.status(500).send(`Error fetching metadata file: ${metadataValue.file}`)
      return
    }

    await new Promise((resolve, reject) => {
      res.status(200)
      res.set({
        immutable: true,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        'content-disposition': `attachment; filename="${file.filename}"`,
        'access-control-expose-headers': 'content-disposition',
        'content-type': 'application/octet-stream',
      })
      file.file.pipe(res)
      file.file.on('error', (err) => reject(err))
      res.on('finish', () => resolve())
    })
    return
  }

  if (metadataValue.literal) {
    res.set('content-type', 'text/plain')
    res.status(200).send(hexToUtf8(metadataValue.literal))
    return
  }

  if (metadataValue.tokenId) {
    res.set('content-type', 'text/plain')
    res.status(200).send(metadataValue.tokenId.toString())
    return
  }

  if ('none' in metadataValue) {
    res.set('content-type', 'text/plain')
    res.status(200).send('')
    return
  }

  logger.warn(`Error fetching metadata: ${metadataKey}:${metadataValue}`)
  res.status(500).send(`Error fetching metadata`)
  return
}

const client = jwksRsa({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: AUTH_JWKS_URI,
})

async function getKey(header, cb) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      logger.warn(`An error occurred getting jwks key ${err}`)
      cb(err, null)
    } else if (key) {
      const signingKey = key.publicKey || key.rsaPublicKey
      cb(null, signingKey)
    }
  })
}

const verifyJwks = async (authHeader) => {
  const authToken = authHeader ? authHeader.replace('Bearer ', '') : ''

  const verifyOptions = {
    audience: AUTH_AUDIENCE,
    issuer: [AUTH_ISSUER],
    algorithms: ['RS256'],
    header: authToken,
  }

  return new Promise((resolve, reject) => {
    jwt.verify(authToken, getKey, verifyOptions, (err, decoded) => {
      if (err) {
        resolve(false)
      } else if (decoded) {
        resolve(true)
      } else {
        logger.warn(`Error verifying jwks`)
        reject({ message: 'An error occurred during jwks verification' })
      }
    })
  })
}

module.exports = {
  runProcess,
  getMembers,
  getItemMetadataSingle,
  getItem,
  getLastTokenId,
  processRoles,
  processMetadata,
  getFile,
  validateInputIds,
  validateTokenId,
  getReadableMetadataKeys,
  hexToUtf8,
  utf8ToUint8Array,
  membershipReducer,
  rolesEnum,
  containsInvalidMembershipRoles,
  getMetadataResponse,
  verifyJwks,
  validateProcess,
}
