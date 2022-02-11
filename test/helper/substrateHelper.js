const { before, after } = require('mocha')
const { Keyring } = require('@polkadot/api')
const { substrateApi: api } = require('../../app/util/substrateApi')

const { PROCESS_IDENTIFIER_LENGTH } = require('../../app/env')

const withNewTestProcess = (context) => {
  const processStr = 'test-process'
  const buffer = Buffer.alloc(PROCESS_IDENTIFIER_LENGTH)
  buffer.write(processStr)
  const processId = `0x${buffer.toString('hex')}`
  let processVersion
  before(async function () {
    // setup process
    await api.isReady
    const keyring = new Keyring({ type: 'sr25519' })
    const sudo = keyring.addFromUri('//Alice')

    const process = await new Promise((resolve) => {
      let unsub = null
      api.tx.sudo
        .sudo(api.tx.processValidation.createProcess(processId, []))
        .signAndSend(sudo, (result) => {
          if (result.status.isInBlock) {
            const { event } = result.events.find(({ event: { method } }) => method === 'ProcessCreated')

            const data = event.data
            const process = {
              id: processStr,
              version: data[1].toNumber(),
            }

            unsub()
            resolve(process)
          }
        })
        .then((res) => {
          unsub = res
        })
    })
    processVersion = process.version
    context.process = process
  })

  after(async function () {
    // disable process
    await api.isReady
    const keyring = new Keyring({ type: 'sr25519' })
    const sudo = keyring.addFromUri('//Alice')

    await new Promise((resolve) => {
      let unsub = null
      api.tx.sudo
        .sudo(api.tx.processValidation.disableProcess(processId, processVersion))
        .signAndSend(sudo, (result) => {
          if (result.status.isInBlock) {
            unsub()
            resolve()
          }
        })
        .then((res) => {
          unsub = res
        })
    })
  })
}

module.exports = {
  withNewTestProcess,
}
