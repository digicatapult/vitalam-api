const logger = require('../../logger')

module.exports = function (apiService) {
  const doc = {
    GET: async function (req, res) {
      try {
        const result = await apiService.findLastTokenId()
        res.status(200).json({ id: result })
        return
      } catch (err) {
        logger.error(`Error getting latest token. Error was ${err.message || JSON.stringify(err)}`)
        if (!res.headersSent) {
          res.status(500).send(`Error getting latest token`)
          return
        }
      }
    },
  }

  doc.GET.apiDoc = {
    summary: 'Get last token',
    responses: {
      200: {
        description: 'Return last token',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/LastToken',
            },
          },
        },
      },
      401: {
        description: 'An unauthorized error occurred',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/responses/UnauthorizedError',
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
    security: [{ bearerAuth: [] }],
    tags: ['system'],
  }

  return doc
}
