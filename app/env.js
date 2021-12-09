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
  AUTH_JWKS_URI: envalid.url(),
  AUTH_AUDIENCE: envalid.str(),
  AUTH_ISSUER: envalid.url(),
  AUTH_TOKEN_URL: envalid.url(),
  LEGACY_METADATA_KEY: envalid.str({ default: '' }),
  METADATA_KEY_LENGTH: envalid.num({ default: 32 }),
  METADATA_VALUE_LITERAL_LENGTH: envalid.num({ default: 32 }),
  MAX_METADATA_COUNT: envalid.num({ default: 16 }),
  API_VERSION: envalid.str({ default: version }),
  API_MAJOR_VERSION: envalid.str({ default: 'v2' }),
  FILE_UPLOAD_MAX_SIZE: envalid.num({ default: 200 * 1024 * 1024 }),
})

module.exports = {
  ...vars,
}
