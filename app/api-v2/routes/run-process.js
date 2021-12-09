const formidable = require('formidable')
const logger = require('../../logger')
const { validateInputIds, processRoles, processMetadata, rolesEnum } = require('../../util/appUtil')
const { LEGACY_METADATA_KEY } = require('../../env')

module.exports = function (apiService) {
  const doc = {
    POST: async function (req, res) {
      const form = formidable({ multiples: true })

      form.parse(req, async (formError, fields, files) => {
        try {
          if (formError) {
            logger.error(`Error processing form ${formError}`)
            res.status(500).json({ message: 'Unexpected error processing input' })
            return
          }

          let request = null
          try {
            request = JSON.parse(fields.request)
          } catch (parseError) {
            logger.trace(`Invalid user input ${parseError}`)
            res.status(400).json({ message: `Invalid user input ${parseError}` })
            return
          }

          if (!request || !request.inputs || !request.outputs) {
            logger.trace(`Request missing input and/or outputs`)
            res.status(400).json({ message: `Request missing input and/or outputs` })
            return
          }

          const inputsValid = await validateInputIds(request.inputs)
          if (!inputsValid) {
            logger.trace(`Some inputs were invalid`)
            res.status(400).json({ message: `Some inputs were invalid: ${JSON.stringify(request.inputs)}` })
            return
          }

          const outputs = await Promise.all(
            request.outputs.map(async (output) => {
              //catch legacy owner
              if (output.owner) {
                output.roles = { [rolesEnum[0]]: output.owner }
              }
              //catch legacy single metadataFile
              if (output.metadataFile) {
                output.metadata = { [LEGACY_METADATA_KEY]: { type: 'FILE', value: output.metadataFile } }
              }

              if (!output.roles || output.roles.length === 0) {
                logger.trace(`Request missing roles`)
                res.status(400).json({ message: `Request missing roles` })
                return
              }

              try {
                return {
                  roles: await processRoles(output.roles),
                  metadata: await processMetadata(output.metadata, files),
                }
              } catch (err) {
                logger.trace(`Invalid outputs: ${err.message}`)
                res.status(400).json({ message: err.message })
                return
              }
            })
          )

          let result
          try {
            result = await apiService.runProcess(request.inputs, outputs)
          } catch (err) {
            logger.error(`Unexpected error running process: ${err}`)
            res.status(500).json({
              message: `Unexpected error processing items`,
            })
          }

          res.status(200).json(result)
        } catch (err) {
          logger.error(`Error running process. Error was ${err.message || JSON.stringify(err)}`)
          if (!res.headersSent) {
            res.status(500).send(`Error running process`)
            return
          }
        }
      })
    },
  }

  doc.POST.apiDoc = {
    summary: 'Governs the creation and destruction of all tokens in the system',
    parameters: [
      {
        description: 'Inputs to be created within the system',
        in: 'body',
        required: true,
        name: 'request',
        allowEmptyValue: true,
        schema: {
          properties: {
            request: {
              properties: {
                inputs: {
                  items: {
                    $ref: '#/components/schemas/Input',
                  },
                },
                outputs: {
                  items: {
                    $ref: '#/components/schemas/Output',
                  },
                },
              },
            },
          },
        },
      },
    ],
    responses: {
      200: {
        description: 'Return the ids of tokens created by this running process',
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  items: {
                    $ref: '#/components/schemas/RunProcessMintedToken',
                  },
                },
                {
                  $ref: '#/components/schemas/RunProcessMessage',
                },
              ],
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
    security: [{ bearerAuth: [] }],
    tags: ['system'],
  }

  return doc
}
