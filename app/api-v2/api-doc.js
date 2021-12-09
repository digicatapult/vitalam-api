const { PORT, API_VERSION, API_MAJOR_VERSION } = require('../env')

const apiDoc = {
  openapi: '3.0.3',
  info: {
    title: 'ApiService',
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
            description: 'id of the item',
            type: 'number',
          },
          owner: {
            description: 'owner token of the item',
            type: 'string',
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
            nullable: true,
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
        required: ['id', 'owner', 'creator', 'created_at', 'destroyed', 'parents', 'children', 'metadata'],
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
        description: 'value of the metadata',
        type: 'string',
      },
      MetadataFile: {
        description: 'file of the metadata',
        type: 'string',
        format: 'binary',
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
          owner: {
            description: 'Owner of the run process',
            type: 'string',
          },
          metadata: {
            description: 'Output metadata from the run process results',
            type: 'object',
          },
        },
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
