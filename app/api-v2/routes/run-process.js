const logger = require('../../logger')
const { validateInputIds, processRoles, processMetadata, rolesEnum } = require('../../util/appUtil')
const { LEGACY_METADATA_KEY } = require('../../env')

module.exports = function (apiService) {
  const doc = {
    POST: async function (req, res) {
      let request = null
      try {
        request = JSON.parse(req.body.request)
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

      const parentIndices = new Set()
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

          if (`parent_index` in output) {
            if (output.parent_index > request.inputs.length) {
              logger.trace(`Parent index out of range`)
              res.status(400).json({ message: `Parent index out of range` })
              return
            }
            if (parentIndices.has(output.parent_index)) {
              logger.trace(`Duplicate parent index used`)
              res.status(400).json({ message: `Duplicate parent index used` })
              return
            }
            parentIndices.add(output.parent_index)
          }

          try {
            return {
              roles: await processRoles(output.roles),
              metadata: await processMetadata(output.metadata, req.files),
              parent_index: output.parent_index,
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
    },
  }

  doc.POST.apiDoc = {
    summary: 'Governs the creation and destruction of all tokens in the system',
    requestBody: {
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'binary',
                },
              },
              request: {
                type: 'string',
                description: 'Inputs to be burned and outputs to be created within the system',
              },
            },
            required: ['request'],
          },
        },
      },
    },
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
