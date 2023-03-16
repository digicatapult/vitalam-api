/* eslint no-console: "off" */
import request from 'supertest'
import fetch from 'node-fetch'

import { fileFromPath } from 'formdata-node/file-from-path'
import { FormData } from 'formdata-node'

import env from '../../app/env.js'

const { IPFS_HOST, IPFS_PORT, API_MAJOR_VERSION } = env

export async function healthCheck(app) {
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

export async function addFileRoute(file) {
  const form = new FormData()
  form.append('file', await fileFromPath(file))
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

export async function postRunProcess(app, authToken, process, inputs, outputs) {
  let req = request(app)
    .post(`/${API_MAJOR_VERSION}/run-process`)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', `Bearer ${authToken}`)
    .field(
      'request',
      JSON.stringify({
        process,
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

export async function postRunProcessNoFileAttach(app, authToken, process, inputs, outputs) {
  let req = request(app)
    .post(`/${API_MAJOR_VERSION}/run-process`)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .set('Authorization', `Bearer ${authToken}`)
    .field(
      'request',
      JSON.stringify({
        process,
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

export async function getItemRoute(app, authToken, { id }) {
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

export async function getItemMetadataRoute(app, authToken, { id, metadataKey }) {
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

export async function getLastTokenIdRoute(app, authToken) {
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

export async function getMembersRoute(app, authToken) {
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
