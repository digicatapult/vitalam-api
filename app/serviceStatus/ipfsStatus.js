import fetch from 'node-fetch'

import { startStatusHandler, serviceState } from '../util/statusPoll.js'
import env from '../env.js'

const { IPFS_STATUS_POLL_PERIOD_MS, IPFS_STATUS_TIMEOUT_MS, IPFS_HOST, IPFS_PORT } = env

const versionURL = `http://${IPFS_HOST}:${IPFS_PORT}/api/v0/version`
const peersURL = `http://${IPFS_HOST}:${IPFS_PORT}/api/v0/swarm/peers`
const getStatus = async () => {
  try {
    const results = await Promise.all([fetch(versionURL, { method: 'POST' }), fetch(peersURL, { method: 'POST' })])
    if (results.some((result) => !result.ok)) {
      return {
        status: serviceState.DOWN,
        detail: {
          message: 'Error getting status from IPFS node',
        },
      }
    }

    const [versionResult, peersResult] = await Promise.all(results.map((r) => r.json()))
    const peers = peersResult.Peers || []
    const peerCount = new Set(peers.map((peer) => peer.Peer)).size
    return {
      status: peerCount === 0 ? serviceState.DOWN : serviceState.UP,
      detail: {
        version: versionResult.Version,
        peerCount: peerCount,
      },
    }
  } catch (err) {
    return {
      status: serviceState.DOWN,
      detail: {
        message: 'Error getting status from IPFS node',
      },
    }
  }
}

const startIpfsStatus = () =>
  startStatusHandler({
    getStatus,
    pollingPeriodMs: IPFS_STATUS_POLL_PERIOD_MS,
    serviceTimeoutMs: IPFS_STATUS_TIMEOUT_MS,
  })

export default startIpfsStatus
