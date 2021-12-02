const express = require('express')
const formidable = require('formidable')

const {
  getLastTokenId,
  getItem,
  runProcess,
  processRoles,
  processMetadata,
  getFile,
  validateInputIds,
  validateTokenId,
  getReadableMetadataKeys,
  getItemMetadataSingle,
  hexToUtf8,
  getMembers,
  membershipReducer,
  defaultRoleName,
} = require('../util/appUtil')
const logger = require('../logger')
const { LEGACY_METADATA_KEY } = require('../env')

const router = express.Router()

router.get('/last-token', async (req, res) => {
  try {
    const result = await getLastTokenId()
    res.status(200).json({ id: result })
  } catch (err) {
    logger.error(`Error getting latest token. Error was ${err.message || JSON.stringify(err)}`)
    if (!res.headersSent) {
      res.status(500).send(`Error getting latest token`)
    }
  }
})

router.get('/item/:id', async (req, res) => {
  const id = validateTokenId(req.params.id)

  if (!id) {
    logger.trace(`Invalid id: ${req.params.id}`)
    res.status(400).json({ message: `Invalid id: ${req.params.id}` })
    return
  }

  try {
    const result = await getItem(id)

    result.metadata = getReadableMetadataKeys(result.metadata)

    if (result.id === id) {
      res.status(200).json(result)
    } else {
      res.status(404).json({
        message: `Id not found: ${id}`,
      })
    }
  } catch (err) {
    logger.error(`Error token. Error was ${err.message || JSON.stringify(err)}`)
    if (!res.headersSent) {
      res.status(500).send(`Error getting token`)
    }
  }
})

const getMetadataResponse = async (tokenId, metadataKey, res) => {
  const id = validateTokenId(tokenId)

  if (!id) {
    logger.trace(`Invalid id: ${tokenId}`)
    res.status(400).json({ message: `Invalid id: ${tokenId}` })
    return
  }

  let metadataValue
  try {
    metadataValue = await getItemMetadataSingle(id, metadataKey)
  } catch (err) {
    logger.trace(`Invalid metadata request: ${err.message}`)
    res.status(404).json({ message: err.message })
    return
  }

  if (metadataValue.file) {
    let file
    try {
      file = await getFile(metadataValue.file)
    } catch (err) {
      logger.warn(`Error fetching metadata file: ${metadataValue.file}. Error was ${err}`)
      res.status(500).send(`Error fetching metadata file: ${metadataValue.file}`)
      return
    }

    await new Promise((resolve, reject) => {
      res.status(200)
      res.set({
        immutable: true,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
      })
      file.file.pipe(res)
      file.file.on('error', (err) => reject(err))
      res.on('finish', () => resolve())
    })
    return
  }

  if (metadataValue.literal) {
    res.set('content-type', 'text/plain')
    res.status(200).send(hexToUtf8(metadataValue.literal))
    return
  }

  if ('none' in metadataValue) {
    res.set('content-type', 'text/plain')
    res.status(200).send('')
    return
  }

  logger.warn(`Error fetching metadata: ${metadataKey}:${metadataValue}`)
  res.status(500).send(`Error fetching metadata`)
  return
}

// legacy route, gets metadata with legacy key
router.get('/item/:id/metadata', async (req, res) => {
  getMetadataResponse(req.params.id, LEGACY_METADATA_KEY, res)
})

router.get('/item/:id/metadata/:metadataKey', async (req, res) => {
  getMetadataResponse(req.params.id, req.params.metadataKey, res)
})

router.get('/members', async (req, res) => {
  try {
    const members = await getMembers()
    const membershipMembers = membershipReducer(members)

    res.status(200).json(membershipMembers)
  } catch (err) {
    logger.error(`Error getting members. Error was ${err.message || JSON.stringify(err)}`)
    if (!res.headersSent) {
      res.status(500).send(`Error getting members`)
    }
  }
})

router.post('/run-process', async (req, res) => {
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

      if (!(await validateInputIds(request.inputs))) {
        logger.trace(`Some inputs were invalid`)
        res.status(400).json({ message: `Some inputs were invalid: ${JSON.stringify(request.inputs)}` })
        return
      }

      const outputs = await Promise.all(
        request.outputs.map(async (output) => {
          //catch legacy owner
          if (output.owner) {
            output.roles = { [defaultRoleName]: output.owner }
          }
          //catch legacy single metadataFile
          if (output.metadataFile) {
            output.metadata = { [LEGACY_METADATA_KEY]: { type: 'FILE', value: output.metadataFile } }
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
        result = await runProcess(request.inputs, outputs)
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
      }
    }
  })
})

module.exports = router
