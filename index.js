'use strict'

require('assert-env')([
  'APP_LOG_LEVEL',
  'APP_NAME'
])

const bunyan = require('bunyan')
const BunyanStackDriver = require('bunyan-stackdriver')
const errToJSON = require('error-to-json')
const isObject = require('101/is-object')
const pick = require('101/pick')
const put = require('101/put')
const reqToJSON = require('request-to-json')
const shimmer = require('shimmer')
const toArray = require('to-array')

// "fatal" (60): The service/app is going to stop or become unusable now. An operator should definitely look into this soon.
// "error" (50): Fatal for a particular request, but the service/app continues servicing other requests. An operator should look at this soon(ish).
// "warn"  (40): A note on something that should probably be looked at by an operator eventually.
// "info"  (30): Detail on regular operation.
// "debug" (20): Anything else, i.e. too verbose to be included in "info" level.
// "trace" (10): Logging from external libraries used by your app or very detailed application logging.
const opts = {
  name: process.env.APP_NAME,
  level: process.env.APP_LOG_LEVEL,
  serializers: {
    ctx: (ctx) => (ctx && ctx.url)
      ? pick(ctx, ['method', 'url', 'body', 'headers', 'id', 'token', 'me'])
      : pick(ctx, ['id', 'token', 'me']),
    err: errToJSON,
    req: reqToJSON
  }
}
if (process.env.ENABLE_GCLOUD_LOG) {
  opts.streams = [
    {
      type: "raw", // faster; makes Bunyan send objects instead of stringifying messages
      stream: new BunyanStackDriver()
    }
  ]
}
const log = module.exports = bunyan.createLogger(opts)

// allows for args in any order..
const names = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace'
]
names.forEach(function (name) {
  shimmer.wrap(log, name, function (orig) {
    return function (obj, msg) {
      let tmp
      let args
      if (msg && typeof msg === 'object') {
        tmp = msg
        msg = obj
        obj = tmp
        args = [obj, msg]
      } else {
        args = Array.prototype.slice.call(arguments)
      }
      return orig.apply(this, args)
    }
  })
})
