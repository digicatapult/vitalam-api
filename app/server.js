const express = require('express')
const cors = require('cors')
const pinoHttp = require('pino-http')
const { initialize } = require('express-openapi')
const swaggerUi = require('swagger-ui-express')
const multer = require('multer')
const path = require('path')
const bodyParser = require('body-parser')
const compression = require('compression')
const { PORT, API_VERSION, API_MAJOR_VERSION } = require('./env')
const logger = require('./logger')
const apiDoc = require('./api-v3/api-doc')
const apiService = require('./api-v3/services/apiService')
const { startStatusHandlers } = require('./serviceStatus')
const { serviceState } = require('./util/statusPoll')
const { verifyJwks } = require('./util/appUtil')

async function createHttpServer() {
  const requestLogger = pinoHttp({ logger })
  const app = express()
  const statusHandler = await startStatusHandlers()

  app.use(cors())
  app.use(compression())
  app.use(bodyParser.json())

  const serviceStatusStrings = {
    [serviceState.UP]: 'ok',
    [serviceState.DOWN]: 'down',
    [serviceState.ERROR]: 'error',
  }
  app.get('/health', async (req, res) => {
    const status = statusHandler.status
    const detail = statusHandler.detail
    const code = status === serviceState.UP ? 200 : 503
    res.status(code).send({ version: API_VERSION, status: serviceStatusStrings[status] || 'error', detail })
  })

  app.use((req, res, next) => {
    if (req.path !== '/health') {
      requestLogger(req, res)
    }

    next()
  })

  const multerStorage = multer.diskStorage({})
  initialize({
    app,
    apiDoc: apiDoc,
    consumesMiddleware: {
      'multipart/form-data': function (req, res, next) {
        multer({ storage: multerStorage }).any()(req, res, function (err) {
          if (err) return next(err)
          next()
        })
      },
    },
    securityHandlers: {
      bearerAuth: (req) => {
        return verifyJwks(req.headers['authorization'])
      },
    },
    dependencies: {
      apiService: apiService,
    },
    paths: [path.resolve(__dirname, `api-${API_MAJOR_VERSION}/routes`)],
  })

  const options = {
    swaggerOptions: {
      urls: [
        {
          url: `http://localhost:${PORT}/${API_MAJOR_VERSION}/api-docs`,
          name: 'ApiService',
        },
      ],
    },
  }

  app.use(`/${API_MAJOR_VERSION}/swagger`, swaggerUi.serve, swaggerUi.setup(null, options))

  // Sorry - app.use checks arity
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.errors) {
      // openapi validation
      res.status(err.status).send(err.errors)
    } else if (err.status) {
      res.status(err.status).send({ error: err.status === 401 ? 'Unauthorised' : err.message })
    } else {
      logger.error('Fallback Error %j', err.stack)
      res.status(500).send('Fatal error!')
    }
  })

  return { app, statusHandler }
}

async function startServer() {
  try {
    const { app, statusHandler } = await createHttpServer()

    const server = await new Promise((resolve, reject) => {
      let resolved = false
      const server = app.listen(PORT, (err) => {
        if (err) {
          if (!resolved) {
            resolved = true
            reject(err)
          }
        }
        logger.info(`Listening on port ${PORT} `)
        if (!resolved) {
          resolved = true
          resolve(server)
        }
      })
      server.on('error', (err) => {
        if (!resolved) {
          resolved = true
          reject(err)
        }
      })
    })

    const closeHandler = (exitCode) => async () => {
      server.close(async () => {
        await statusHandler.close()
        process.exit(exitCode)
      })
    }

    const setupGracefulExit = ({ sigName, exitCode }) => {
      process.on(sigName, closeHandler(exitCode))
    }
    setupGracefulExit({ sigName: 'SIGINT', server, exitCode: 0 })
    setupGracefulExit({ sigName: 'SIGTERM', server, exitCode: 143 })
  } catch (err) {
    logger.fatal('Fatal error during initialisation: %s', err.message)
    process.exit(1)
  }
}

module.exports = { startServer, createHttpServer }
