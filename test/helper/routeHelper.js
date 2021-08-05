/* eslint no-console: "off" */
const fs = require('fs')
const request = require('supertest')
const fetch = require('node-fetch')
const FormData = require('form-data')
const { IPFS_HOST, IPFS_PORT } = require('../../app/env')

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
    .post('/auth')
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

async function addItemRoute(app, authToken, inputs, outputs) {
  let req = request(app)
    .post('/run-process')
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

  req = outputs.reduce((acc, { metadataFile }) => {
    return req.attach(metadataFile, metadataFile)
  }, req)

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
    .get(`/item/${id}`)
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

async function getItemMetadataRoute(app, authToken, { id }) {
  return request(app)
    .get(`/item/${id}/metadata`)
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
    .get('/last-token')
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

module.exports = {
  healthCheck,
  getAuthTokenRoute,
  addItemRoute,
  addFileRoute,
  addFileRouteLegacy,
  getItemRoute,
  getItemMetadataRoute,
  getLastTokenIdRoute,
}
