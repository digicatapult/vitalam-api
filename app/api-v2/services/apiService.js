const {
  getItem,
  runProcess: runProcessUtil,
  getMembers: getMembersUtil,
  getLastTokenId: getLastTokenIdUtil,
} = require('../../util/appUtil')

async function findItemById(tokenId) {
  return getItem(tokenId)
}

async function findLastTokenId() {
  return getLastTokenIdUtil()
}

async function findMembers() {
  return getMembersUtil()
}

async function runProcess(inputs, outputs) {
  return runProcessUtil(inputs, outputs)
}

module.exports = {
  findItemById,
  findLastTokenId,
  findMembers,
  runProcess,
}
