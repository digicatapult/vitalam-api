/* eslint no-console: "off" */
const fs = require('fs')
const request = require('supertest')
const fetch = require('node-fetch')
const FormData = require('form-data')
const { IPFS_HOST, IPFS_PORT, API_MAJOR_VERSION } = require('../../app/env')

async function healthCheck(app) {
  return request(app)
    .get('/health')
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .then((response) => {
      return response
    })
    .catch((err) => {
      console.error(`healthCheckErr ${err}`)
      return err
    })
}

async function getAuthTokenRoute(app) {
  return request(app)
    .post(`/${API_MAJOR_VERSION}/auth`)
    .send({ client_id: 'test', client_secret: 'test' })
    .then((res) => res)
    .catch((err) => console.error('getTokenErr', err))
}

async function addFileRoute(file) {
  const form = new FormData()
  form.append('file', fs.createReadStream(file))
  const body = await fetch(`http://${IPFS_HOST}:${IPFS_PORT}/api/v0/add?cid-version=0&wrap-with-directory=true`, {
    method: 'POST',
    body: form,
  })
  const text = await body.text()
  const json = text
    .split('\n')
    .filter((obj) => obj.length > 0)
    .map((obj) => JSON.parse(obj))

  return json
}

// Route for old method of uploading tokens without being wrapped in a directory
async function addFileRouteLegacy(file) {
  const form = new FormData()
  form.append('file', fs.createReadStream(file))
  const body = await fetch(`http://${IPFS_HOST}:${IPFS_PORT}/api/v0/add?cid-version=0`, {
    method: 'POST',
    body: form,
  })

  return body.json()
}

async function postRunProcess(app, authToken, inputs, outputs) {
  let req = request(app)
    .post(`/${API_MAJOR_VERSION}/run-process`)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', `Bearer ${authToken}`)
    .field(
      'request',
      JSON.stringify({
        inputs,
        outputs,
      })
    )

  outputs.forEach((output) => {
    if (output.metadata) {
      for (const value of Object.values(output.metadata)) {
        if (value !== null && value.type === 'FILE') {
          req.attach(value.value, value.value)
        }
      }
    }
    // legacy
    if (output.metadataFile) {
      req.attach(output.metadataFile, output.metadataFile)
    }
  })

  return req
    .then((response) => {
      return response
    })
    .catch((err) => {
      console.error(`addItemErr ${err}`)
      return err
    })
}

async function postRunProcessNoFileAttach(app, authToken, inputs, outputs) {
  let req = request(app)
    .post(`/${API_MAJOR_VERSION}/run-process`)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', `Bearer ${authToken}`)
    .field(
      'request',
      JSON.stringify({
        inputs,
        outputs,
      })
    )

  return req
    .then((response) => {
      return response
    })
    .catch((err) => {
      console.error(`addItemErr ${err}`)
      return err
    })
}

async function getItemRoute(app, authToken, { id }) {
  return request(app)
    .get(`/${API_MAJOR_VERSION}/item/${id}`)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', `Bearer ${authToken}`)
    .then((response) => {
      return response
    })
    .catch((err) => {
      console.error(`getItemErr ${err}`)
      return err
    })
}

async function getItemMetadataRoute(app, authToken, { id, metadataKey }) {
  return request(app)
    .get(`/${API_MAJOR_VERSION}/item/${id}/metadata/${metadataKey}`)
    .set('Accept', 'application/octet-stream')
    .set('Content-Type', 'application/octet-stream')
    .set('Authorization', `Bearer ${authToken}`)
    .then((response) => {
      return response
    })
    .catch((err) => {
      console.error(`getItemErr ${err}`)
      return err
    })
}

async function getItemMetadataRouteLegacy(app, authToken, { id }) {
  return request(app)
    .get(`/${API_MAJOR_VERSION}/item/${id}/metadata`)
    .set('Accept', 'application/octet-stream')
    .set('Content-Type', 'application/octet-stream')
    .set('Authorization', `Bearer ${authToken}`)
    .then((response) => {
      return response
    })
    .catch((err) => {
      console.error(`getItemErr ${err}`)
      return err
    })
}

async function getLastTokenIdRoute(app, authToken) {
  return request(app)
    .get(`/${API_MAJOR_VERSION}/last-token`)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', `Bearer ${authToken}`)
    .then((response) => {
      return response
    })
    .catch((err) => {
      console.error(`getLastTokenIdErr ${err}`)
      return err
    })
}

async function getMembersRoute(app, authToken) {
  return request(app)
    .get(`/${API_MAJOR_VERSION}/members`)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', `Bearer ${authToken}`)
    .then((response) => {
      return response
    })
    .catch((err) => {
      console.error(`getMembersErr ${err}`)
      return err
    })
}

module.exports = {
  healthCheck,
  getAuthTokenRoute,
  postRunProcess,
  postRunProcessNoFileAttach,
  addFileRoute,
  addFileRouteLegacy,
  getItemRoute,
  getItemMetadataRoute,
  getItemMetadataRouteLegacy,
  getLastTokenIdRoute,
  getMembersRoute,
}
