import {
  getItem,
  runProcess as runProcessUtil,
  getMembers as getMembersUtil,
  getLastTokenId as getLastTokenIdUtil,
} from '../../util/appUtil.js'

export async function findItemById(tokenId) {
  return getItem(tokenId)
}

export async function findLastTokenId() {
  return getLastTokenIdUtil()
}

export async function findMembers() {
  return getMembersUtil()
}

export async function runProcess(process, inputs, outputs) {
  return runProcessUtil(process, inputs, outputs)
}

export default {
  findItemById,
  findLastTokenId,
  findMembers,
  runProcess,
}
