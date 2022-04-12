const { buildApi } = require('@digicatapult/dscp-node')

const {
  API_HOST,
  API_PORT,
  METADATA_KEY_LENGTH,
  METADATA_VALUE_LITERAL_LENGTH,
  PROCESS_IDENTIFIER_LENGTH,
} = require('../env')
const logger = require('../logger')

const {
  api: substrateApi,
  types,
  keyring,
} = buildApi({
  options: {
    apiHost: API_HOST,
    apiPort: API_PORT,
    metadataKeyLength: METADATA_KEY_LENGTH,
    metadataValueLiteralLength: METADATA_VALUE_LITERAL_LENGTH,
    processorIdentifierLength: PROCESS_IDENTIFIER_LENGTH,
    logger,
  },
})

module.exports = {
  substrateApi,
  types,
  keyring,
}
