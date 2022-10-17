import { expect } from 'chai'

// TODO compare block_number...
export function assertItem(actualResult, expectedResult) {
  expect(actualResult.id).to.equal(expectedResult.id)
  expect(actualResult).has.property('created_at')
  expect(actualResult.roles).to.deep.equal(expectedResult.roles)
  expect(actualResult.creator).to.equal(expectedResult.creator)
  expect(actualResult.parents).to.deep.equal(expectedResult.parents)
  expect(actualResult.children).to.deep.equal(expectedResult.children)
  if (expectedResult.children === null) {
    expect(actualResult.destroyed_at).to.equal(null)
  } else {
    expect(actualResult.destroyed_at).to.not.equal(null)
  }
  expect(actualResult.metadata_keys).to.deep.equal(expectedResult.metadata_keys)
}
