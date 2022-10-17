import { before, after } from 'mocha'
import { substrateApi as api, keyring } from '../../app/util/substrateApi.js'

export const withNewTestProcess = (process) => {
  const processStr = 'test-process'
  const buffer = Buffer.from(processStr, 'utf8')
  const processId = `0x${buffer.toString('hex')}`
  let processVersion
  before(async function () {
    // setup process
    await api.isReady
    const sudo = keyring.addFromUri('//Alice')

    const newProcess = await new Promise((resolve) => {
      let unsub = null
      api.tx.sudo
        .sudo(
          api.tx.processValidation.createProcess(processId, [
            {
              Restriction: 'None',
            },
          ])
        )
        .signAndSend(sudo, (result) => {
          if (result.status.isInBlock) {
            const { event } = result.events.find(({ event: { method } }) => method === 'ProcessCreated')

            const data = event.data
            const newProcess = {
              id: processStr,
              version: data[1].toNumber(),
            }

            unsub()
            resolve(newProcess)
          }
        })
        .then((res) => {
          unsub = res
        })
    })
    processVersion = newProcess.version
    Object.assign(process, newProcess)
  })

  after(async function () {
    // disable process
    await api.isReady
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
