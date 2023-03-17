export class ExtrinsicError extends Error {
  error
  code

  constructor(errorType, code) {
    super(`Error processing extrinsic: ${errorType}`)
    this.error = errorType
    this.code = code
  }
}
