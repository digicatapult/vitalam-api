const fetch = require('node-fetch')
const { AUTH_TOKEN_URL, AUTH_AUDIENCE } = require('../../env')
const logger = require('../../logger')

module.exports = function () {
  const doc = {
    POST: async function (req, res) {
      if (!req.body || !req.body.client_id || !req.body.client_secret) {
        res.status(400).send({ error: '"client_id" and "client_secret" fields required' })
        return
      }

      try {
        const response = await fetch(AUTH_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: req.body.client_id,
            client_secret: req.body.client_secret,
            audience: AUTH_AUDIENCE,
          }),
        })
        const data = await response.json()

        if (response.status === 200) {
          res.status(200).json(data)
          return
        } else {
          logger.error(`Auth0 error: ${data.error_description}`)
          res.status(response.status).send(data)
          return
        }
      } catch (err) {
        logger.error('Error:', err.message)
        res.status(500).send(`Error: ${err}`)
        return
      }
    },
  }

  doc.POST.apiDoc = {
    summary: 'Post auth',
    parameters: [
      {
        description: 'Client Id of the request',
        in: 'body',
        required: true,
        name: 'client_id',
        allowEmptyValue: true,
      },
      {
        description: 'Client Secret of the request',
        in: 'body',
        required: true,
        name: 'client_secret',
        allowEmptyValue: true,
      },
    ],
    responses: {
      200: {
        description: 'Return authentication token',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AuthToken',
            },
          },
        },
      },
      400: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/responses/BadRequestError',
            },
          },
        },
      },
      default: {
        description: 'An error occurred',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/responses/Error',
            },
          },
        },
      },
    },
    security: [],
    tags: ['auth'],
  }

  return doc
}
