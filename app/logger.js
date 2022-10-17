import pino from 'pino'
import env from './env.js'

const logger = pino(
  {
    name: 'API',
    level: env.LOG_LEVEL,
    redact: {
      paths: ['USER_URI', '[*].USER_URI'],
      censor: (args) => {
        if (args === '' || args === null || args === undefined) {
          return '[EMPTY]'
        } else {
          return '[REDACTED]'
        }
      },
    },
  },
  process.stdout
)

logger.debug('Env: %j', env)

export default logger
