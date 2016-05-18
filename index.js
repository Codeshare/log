'use strict'

require('assert-env')([
  'APP_LOG_LEVEL',
  'APP_NAME'
])

const bunyan = require('bunyan')
const _errToJSON = require('error-to-json')

function errToJSON (err) {
  const json = _errToJSON(err)
  if (json.data.err) {
    json.data.err = _errToJSON(json.data.err)
  }
  return json
}

// "fatal" (60): The service/app is going to stop or become unusable now. An operator should definitely look into this soon.
// "error" (50): Fatal for a particular request, but the service/app continues servicing other requests. An operator should look at this soon(ish).
// "warn"  (40): A note on something that should probably be looked at by an operator eventually.
// "info"  (30): Detail on regular operation.
// "debug" (20): Anything else, i.e. too verbose to be included in "info" level.
// "trace" (10): Logging from external libraries used by your app or very detailed application logging.

module.exports = bunyan.createLogger({
  name: process.env.APP_NAME,
  level: process.env.APP_LOG_LEVEL,
  serializers: {
    err: errToJSON,
    args: (args) => Array.prototype.slice.call(args)
  },
  streams: [
    {
      stream: process.stderr,
      level: 'trace'
    }
  ]
})
