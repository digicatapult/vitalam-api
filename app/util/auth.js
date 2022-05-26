const jwksRsa = require('jwks-rsa')
const jwt = require('jsonwebtoken')

const { AUTH_JWKS_URI, AUTH_AUDIENCE, AUTH_ISSUER, AUTH_TYPE } = require('../env')
const logger = require('../logger')

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

const getDefaultSecurity = () => {
  switch (AUTH_TYPE) {
    case 'NONE':
      return []
    case 'JWT':
      return [{ bearerAuth: [] }]
    default:
      return []
  }
}

module.exports = {
  verifyJwks,
  getDefaultSecurity,
}
