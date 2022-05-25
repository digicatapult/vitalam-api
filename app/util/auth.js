const { AUTH_TYPE } = require('../env')

const openApiSecurity = () => {
  console.log(AUTH_TYPE)
  switch (AUTH_TYPE) {
    case 'NONE':
      return []
    case 'JWT':
      return [{ bearerAuth: [] }]
    default:
      return []
  }
}

module.exports = {
  openApiSecurity,
}
