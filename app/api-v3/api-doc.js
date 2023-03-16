import env from '../env.js'

const { PORT, API_VERSION, API_MAJOR_VERSION, EXTERNAL_ORIGIN, EXTERNAL_PATH_PREFIX } = env

let url = EXTERNAL_ORIGIN || `http://localhost:${PORT}`
if (EXTERNAL_PATH_PREFIX) {
  url = `${url}/${EXTERNAL_PATH_PREFIX}`
}
url = `${url}/${API_MAJOR_VERSION}`

const apiDoc = {
  openapi: '3.0.3',
  info: {
    title: 'DSCP API',
    version: API_VERSION,
  },
  servers: [
    {
      url,
    },
  ],
  components: {
    responses: {
      NotFoundError: {
        description: 'This resource cannot be found',
      },
      BadRequestError: {
        description: 'The request is invalid',
      },
      UnauthorizedError: {
        description: 'Access token is missing or invalid',
      },
      Error: {
        description: 'An error occurred',
      },
    },
    schemas: {
      AccountId: {
        type: 'string',
        description: 'SS58 Address',
        example: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      },
      AuthToken: {
        type: 'object',
        properties: {
          access_token: {
            description: 'authentication token',
            type: 'string',
          },
          expires_in: {
            description: 'expiry delta time in milliseconds',
            type: 'number',
          },
          token_type: {
            description: 'type of the authentication token',
            type: 'string',
          },
        },
      },
      Item: {
        type: 'object',
        properties: {
          id: {
            description: 'id of this token',
            type: 'number',
          },
          original_id: {
            description: 'original id of the asset this token refers to',
            type: 'number',
          },
          roles: {
            $ref: '#/components/schemas/Roles',
          },
          creator: {
            description: 'creator token of the item',
            type: 'string',
          },
          created_at: {
            description: 'block number the item was created at',
            type: 'number',
          },
          destroyed: {
            description: 'block number the item was destroyed',
            type: 'number',
            nullable: true,
          },
          parents: {
            description: 'parents of the item',
            type: 'array',
            items: {
              type: 'number',
            },
          },
          children: {
            description: 'children of the item',
            type: 'array',
            items: {
              type: 'number',
            },
            nullable: true,
          },
          metadata_keys: {
            description: 'metadata keys of the item',
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        required: ['id', 'roles', 'creator', 'created_at', 'destroyed', 'parents', 'children', 'metadata'],
      },
      LastToken: {
        type: 'object',
        properties: {
          id: {
            description: 'id of the token',
            type: 'number',
          },
        },
        required: ['id'],
      },
      Member: {
        type: 'object',
        properties: {
          address: {
            description: 'token of the member',
            type: 'string',
          },
        },
        required: ['address'],
      },
      Metadata: {
        description: 'metadata to add when creating an item',
        type: 'object',
        additionalProperties: {
          description: 'metadata item',
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['FILE', 'LITERAL', 'NONE'],
            },
            value: {
              description:
                'type FILE: value is filepath; type LITERAL: value is literal value; type NONE: no value is expected',
              type: 'string',
            },
          },
        },
      },
      MetadataLiteral: {
        description: 'value of the metadata',
        type: 'string',
      },
      MetadataFile: {
        description: 'file of the metadata',
        type: 'string',
        format: 'binary',
      },
      Roles: {
        description: 'roles of the item',
        type: 'object',
        properties: {
          Owner: { $ref: '#/components/schemas/AccountId' },
          Customer: { $ref: '#/components/schemas/AccountId' },
          AdditiveManufacturer: { $ref: '#/components/schemas/AccountId' },
          Laboratory: { $ref: '#/components/schemas/AccountId' },
          Buyer: { $ref: '#/components/schemas/AccountId' },
          Supplier: { $ref: '#/components/schemas/AccountId' },
          Reviewer: { $ref: '#/components/schemas/AccountId' },
        },
        additionalProperties: false,
        required: ['Owner'],
      },
      RunProcessMintedToken: {
        description: 'minted token',
        type: 'number',
      },
      RunProcessMessage: {
        description: 'minted token',
        type: 'object',
        properties: {
          message: {
            description: 'Message',
            type: 'string',
          },
        },
      },
      Input: {
        description: 'Input token id',
        type: 'number',
      },
      Output: {
        description: 'Output objects that describe tokens to be created by running this process',
        type: 'object',
        properties: {
          roles: {
            $ref: '#/components/schemas/Roles',
          },
          metadata: {
            $ref: '#/components/schemas/Metadata',
          },
        },
        required: ['roles', 'metadata'],
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },

  paths: {},
}

export default apiDoc
