const { PORT, API_VERSION, API_MAJOR_VERSION } = require('../env')

const apiDoc = {
  openapi: '3.0.3',
  info: {
    title: 'VITALam API',
    version: API_VERSION,
  },
  servers: [
    {
      url: `http://localhost:${PORT}/${API_MAJOR_VERSION}`,
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
          Admin: { $ref: '#/components/schemas/AccountId' },
          ManufacturingEngineer: { $ref: '#/components/schemas/AccountId' },
          ProcurementBuyer: { $ref: '#/components/schemas/AccountId' },
          ProcurementPlanner: { $ref: '#/components/schemas/AccountId' },
          Supplier: { $ref: '#/components/schemas/AccountId' },
        },
        additionalProperties: false,
        required: ['Admin'],
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
          parent_index: {
            description: 'index of the inputs that this output will be uniquely assigned to',
            type: 'number',
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

module.exports = apiDoc
