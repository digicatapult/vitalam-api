import logger from '../../logger.js'
import { membershipReducer } from '../../util/appUtil.js'
import { getDefaultSecurity } from '../../util/auth.js'

export default function (apiService) {
  const doc = {
    GET: async function (req, res) {
      try {
        const members = await apiService.findMembers()
        const membershipMembers = membershipReducer(members)

        res.status(200).json(membershipMembers)
        return
      } catch (err) {
        logger.error(`Error getting members. Error was ${err.message || JSON.stringify(err)}`)
        if (!res.headersSent) {
          res.status(500).send(`Error getting members`)
          return
        }
      }
    },
  }

  doc.GET.apiDoc = {
    summary: 'Get members',
    responses: {
      200: {
        description: 'Return members',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Member',
              },
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
    security: getDefaultSecurity(),
    tags: ['system'],
  }

  return doc
}
