import express from 'express'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { initialize } from 'express-openapi'
import swaggerUi from 'swagger-ui-express'
import multer from 'multer'
import path from 'path'
import bodyParser from 'body-parser'
import compression from 'compression'

import env from './env.js'
import logger from './logger.js'
import apiDoc from './api-v3/api-doc.js'
import apiService from './api-v3/services/apiService.js'
import { startStatusHandlers } from './serviceStatus/index.js'
import { serviceState } from './util/statusPoll.js'
import { verifyJwks } from './util/auth.js'
import promBundle from 'express-prom-bundle'
import client from 'prom-client'

import url from 'url'
const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { PORT, API_VERSION, API_MAJOR_VERSION, AUTH_TYPE, EXTERNAL_PATH_PREFIX } = env

export async function createHttpServer() {
  const requestLogger = pinoHttp({ logger })
  const app = express()
  const statusHandler = await startStatusHandlers()

  app.use(cors())
  app.use(compression())
  app.use(bodyParser.json())

  client.register.clear()
  app.use(
    promBundle({
      includePath: true,
      promClient: {
        collectDefaultMetrics: {
          prefix: 'dscp_api_',
        },
      },
    })
  )

  const serviceStatusStrings = {
    [serviceState.UP]: 'ok',
    [serviceState.DOWN]: 'down',
    [serviceState.ERROR]: 'error',
  }
  app.get('/health', async (req, res) => {
    const status = statusHandler.status
    const details = statusHandler.detail
    const code = status === serviceState.UP ? 200 : 503
    res.status(code).send({
      version: API_VERSION,
      status: serviceStatusStrings[status] || 'error',
      details: Object.fromEntries(
        Object.entries(details).map(([depName, { status, detail }]) => [
          depName,
          {
            status: serviceStatusStrings[status] || 'error',
            detail,
          },
        ])
      ),
    })
  })

  app.use((req, res, next) => {
    if (req.path !== '/health') {
      requestLogger(req, res)
    }

    next()
  })

  const multerStorage = multer.diskStorage({})
  const securityHandlers =
    AUTH_TYPE === 'JWT'
      ? {
          bearerAuth: (req) => {
            return verifyJwks(req.headers['authorization'])
          },
        }
      : {}

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
    securityHandlers: securityHandlers,
    dependencies: {
      apiService: apiService,
    },
    paths: [path.resolve(__dirname, `api-${API_MAJOR_VERSION}/routes`)],
  })

  const options = {
    swaggerOptions: {
      urls: [
        {
          url: `${apiDoc.servers[0].url}/api-docs`,
          name: 'ApiService',
        },
      ],
    },
  }

  app.use(
    EXTERNAL_PATH_PREFIX ? `/${EXTERNAL_PATH_PREFIX}/${API_MAJOR_VERSION}/swagger` : `/${API_MAJOR_VERSION}/swagger`,
    swaggerUi.serve,
    swaggerUi.setup(null, options)
  )

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

  logger.trace('Registered Express routes: %s', {
    toString: () => {
      return JSON.stringify(app._router.stack.map(({ route }) => route && route.path).filter((p) => !!p))
    },
  })

  return { app, statusHandler }
}

export async function startServer() {
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
