const envalid = require('envalid')
const dotenv = require('dotenv')

const { version } = require('../package.json')

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: 'test/test.env' })
} else {
  dotenv.config({ path: '.env' })
}

const vars = envalid.cleanEnv(process.env, {
  PORT: envalid.port({ default: 3001 }),
  API_HOST: envalid.host({ devDefault: 'localhost' }),
  API_PORT: envalid.port({ default: 9944 }),
  LOG_LEVEL: envalid.str({ default: 'info', devDefault: 'debug' }),
  USER_URI: envalid.str({ devDefault: '//Alice' }),
  IPFS_HOST: envalid.host({ devDefault: 'localhost' }),
  IPFS_PORT: envalid.port({ devDefault: 5001, default: 15001 }),
  AUTH_JWKS_URI: envalid.url({ devDefault: 'https://inteli.eu.auth0.com/.well-known/jwks.json' }),
  AUTH_AUDIENCE: envalid.str({ devDefault: 'inteli-dev' }),
  AUTH_ISSUER: envalid.url({ devDefault: 'https://inteli.eu.auth0.com/' }),
  AUTH_TOKEN_URL: envalid.url({ devDefault: 'https://inteli.eu.auth0.com/oauth/token' }),
  METADATA_KEY_LENGTH: envalid.num({ default: 32 }),
  METADATA_VALUE_LITERAL_LENGTH: envalid.num({ default: 32 }),
  PROCESS_IDENTIFIER_LENGTH: envalid.num({ default: 32 }),
  MAX_METADATA_COUNT: envalid.num({ default: 16 }),
  API_VERSION: envalid.str({ default: version }),
  API_MAJOR_VERSION: envalid.str({ default: 'v3' }),
  FILE_UPLOAD_MAX_SIZE: envalid.num({ default: 200 * 1024 * 1024 }),
  SUBSTRATE_STATUS_POLL_PERIOD_MS: envalid.num({ default: 30 * 1000 }),
  SUBSTRATE_STATUS_TIMEOUT_MS: envalid.num({ default: 2 * 1000 }),
})

module.exports = {
  ...vars,
}
