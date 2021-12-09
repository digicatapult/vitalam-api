# VITALam API

## Description

A `Node.js` API to support communication to the [Substrate-based](https://www.substrate.io/) [`vitalam-node`](https://github.com/digicatapult/vitalam-node) (via [`polkadot-js/api`](https://www.npmjs.com/package/@polkadot/api)) and an [`IPFS`](https://ipfs.io/) node.

## Getting started

First, ensure you're running the correct [version](.node-version) of `npm`, then install dependencies using:

```
npm install
```

The API requires instances of [`vitalam-node`](https://github.com/digicatapult/vitalam-node) and [`IPFS`](https://ipfs.io/).
To bring them up locally:

### `vitalam-node`

Clone [vitalam-node](https://github.com/digicatapult/vitalam-node) and follow the README to setup and build a local node. Then run the following in its root directory:

```
./target/release/vitalam-node --dev
```

### `IPFS`

To install and run `IPFS` on macOS

```sh
brew install ipfs
ipfs daemon
```

Return to the root directory of this repository. Run the application in development mode:

```sh
npm run dev
```

Run tests:

```
npm run test:integration
```

## Authentication

`vitalam-api` uses an [Auth0](https://auth0.com/) Machine to Machine API to issue a JSON Web Token for authentication on its endpoints. You will need to create your own Auth0 API, which can be done for free, and set the appropriate [environment variables](#configuration) (those prefixed with `AUTH`). Follow the start of this [tutorial](https://auth0.com/docs/quickstart/backend/nodejs#configure-auth0-apis) to create an API. Go [here](app/routes/auth.js) and [here](app/auth.js) to see where the environment variables are used.

## Configuration

The following environment variables are used by `vitalam-api` and can be configured. Entries marked as `required` are needed when running `vitalam-api` in production mode.

| variable                      | required | default | description                                                                                                          |
| :---------------------------- | :------: | :-----: | :------------------------------------------------------------------------------------------------------------------- |
| PORT                          |    N     | `3001`  | The port for the API to listen on                                                                                    |
| API_HOST                      |    Y     |    -    | The hostname of the `vitalam-node` the API should connect to                                                         |
| API_PORT                      |    N     | `9944`  | The port of the `vitalam-node` the API should connect to                                                             |
| LOG_LEVEL                     |    N     | `info`  | Logging level. Valid values are [`trace`, `debug`, `info`, `warn`, `error`, `fatal`]                                 |
| USER_URI                      |    Y     |    -    | The Substrate `URI` representing the private key to use when making `vitalam-node` transactions                      |
| IPFS_HOST                     |    Y     |    -    | Hostname of the `IPFS` node to use for metadata storage                                                              |
| IPFS_PORT                     |    N     | `15001` | Port of the `IPFS` node to use for metadata storage                                                                  |
| AUTH_JWKS_URI                 |    Y     |    -    | JSON Web Key Set containing public keys used by the Auth0 API e.g. `https://test.eu.auth0.com/.well-known/jwks.json` |
| AUTH_AUDIENCE                 |    Y     |    -    | Identifier of the Auth0 API                                                                                          |
| AUTH_ISSUER                   |    Y     |    -    | Domain of the Auth0 API e.g. `https://test.eu.auth0.com/`                                                            |
| AUTH_TOKEN_URL                |    Y     |    -    | Auth0 API endpoint that issues an Authorisation (Bearer) access token e.g. `https://test.auth0.com/oauth/token`      |
| LEGACY_METADATA_KEY           |    N     |   ''    | Key given to token metadata posted without a key (such as when posted using the legacy `metadataFile` field)         |
| METADATA_KEY_LENGTH           |    N     |  `32`   | Fixed length of metadata keys                                                                                        |
| METADATA_VALUE_LITERAL_LENGTH |    N     |  `32`   | Fixed length of metadata LITERAL values                                                                              |
| MAX_METADATA_COUNT            |    N     |  `16`   | Maximum number of metadata items allowed per token                                                                   |
| API_VERSION                   |    N     |    -    | API version                                                                                                          |
| API_MAJOR_VERSION             |    N     |    -    | API major version                                                                                                    |
| FILE_UPLOAD_MAX_SIZE          |    N     |    -    | The Maximum file upload size (bytes)                                                                                 |

## Running the API

Having ensured dependencies are installed and running + the relevant environment variables are set, the API can be started in production mode with:

```
npm start
```

## API specification

### Access token endpoint

### POST /auth

Gets an `access_token` via Auth0 for using as authorisation on all other endpoints. Takes a `body` with the following format:

```js
{
    "client_id": "YOUR_CLIENT_ID", // String
    "client_secret": "YOUR_CLIENT_SECRET" // String
}
```

This will return a JSON response (`Content-Type` `application/json`) of the form:

```js
{
    "access_token": "an.example.jwt", // String (JWT)
    "expires_in": 86400, // Number
    "token_type": "Bearer" // String
}
```

### Authenticated endpoints

The rest of the endpoints in `vitalam-api` require authentication in the form of a header `'Authorization: Bearer YOUR_ACCESS_TOKEN'`:

1. [GET /item/:id](#get-/item/:id)
2. [GET /item/:id/metadata/:metadataKey](#get-/item/:id/metadata/:metadataKey)
3. [POST /run-process](#POST-/run-process)
4. [GET /last-token](#get-/last-token)

The following endpoints are maintained for backwards compatibility:

1. [GET /item/:id/metadata](#get-/item/:id/metadata)

### GET /item/:id

Gets the item identified by `id`. Item `id`s are returned by [POST /run-process](#post-/run-process). This will return a JSON response (`Content-Type` `application/json`) of the form:

```js
{
    "id": 42, // Number
    "roles": {"Admin": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"}, // Object
    "creator": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", // String
    "created_at": 4321, // Number
    "destroyed_at": 321 || null, // Nullable<Number>
    "parents": [40, 41], // Array<Number>
    "children": [43, 44] || null // Nullable<Array<Number>>
    "metadata_keys": ["metadataKey1", ..."metadataKeyN"] // Array<String>
}
```

### GET /item/:id/metadata/:metadataKey

Gets the metadata value matching the `metadataKey` for the item identified by `id`. Item `id`s are returned by [POST /run-process](#post-/run-process). If the value is a string, it will be returned with a `Content-Type` of `text/plain`. If the value is a file, it will be returned with a `Content-Type` of `application/octet-stream`. The original `filename` is returned in the `Content-Disposition` header.

### POST /run-process

This endpoint governs the creation and destruction of all tokens in the system. The endpoint takes a `body` of a multi-part form constructed with a `request` field. The `request` field should be a JSON object with the following format:

```js
{
  "inputs": [40, 41] // Array<Number>,
  "outputs": [{ // Array<Output>
    "roles": {
      "Admin": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "Supplier": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      ..."some_other_role_key": "some_account_id"
    }
    "metadata": {
      "some_file": { "type": "FILE", "value": "some_file.txt"},
      "some_literal": {"type": "LITERAL", "value":"some_value"},
      ..."metadataKeyN": {"type": "LITERAL", "value", "some_other_value"}
    }
  }]
}
```

The `inputs` field is an array of token `id`s that identifies the tokens to be consumed by running this process. To create tokens without destroying any inputs simply pass an empty array. To destroy a token, the `AccountId` from the `USER_URI` of the sender must match the `AccountId` associated with the default (`Admin`) role for that token.

The `outputs` field is an array of objects that describe tokens to be created by running this process. To destroy tokens without creating any new ones simply pass an empty array. Each output must reference a `roles` object containing a (key, value) pair for each role associated with the new token. The value is the `AccountId` for the role. At minimum, a token requires the default `Admin` role to be set. The following role keys are accepted:

```json
["Admin", "ManufacturingEngineer", "ProcurementBuyer", "ProcurementPlanner", "Supplier"]
```

Each output must also reference a `metadata` object containing a (key, value) pair for each metadata item associated with the new token. The following metadata value types are accepted:

```json
["FILE", "LITERAL", "NONE"]
```

The key identifies the metadata item, and the value is either a string value, or for files, a file path. Each file path must match a corresponding file attached to the request.

The response of this API will be JSON (`Content-Type` `application/json`) of the following form

```json
[42, 43]
```

Each element of the array contains the `id` of the `output` that was described in the corresponding index of the `outputs` array.

### GET /last-token

Gets the `id` of the last item created by [POST /run-process](#post-/run-process). This will return a JSON response (`Content-Type` `application/json`) of the form:

```js
{
    "id": 5, // Number
}
```

### GET /item/:id/metadata

Maintained for backwards compatibility. New tokens should use [GET /item/:id/metadata/:metadataKey](#get-/item/:id/metadata/:metadataKey).

Gets the metadata file matching the `LEGACY_METADATA_KEY` env for the item identified by `id`. Item `id`s are returned by [POST /run-process](#post-/run-process). The file will be returned with a `Content-Type` of `application/octet-stream`. The original `filename` is returned in the `Content-Disposition` header.

### GET /members

Each element returned represents a member and their corresponding address in the following format:

```json
[
  {
    "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
  }
]
```
