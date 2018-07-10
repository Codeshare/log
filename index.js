'use strict'

require('@codeshare/env').assert([
  'APP_LOG_LEVEL',
  'APP_NAME',
  'ENABLE_GCLOUD_ERROR',
  'SENTRY_DSN'
])

const bunyan = require('bunyan')
const errToJSON = require('error-to-json')
const isObject = require('101/is-object')
const pick = require('101/pick')
const put = require('101/put')
const reqToJSON = require('request-to-json')
const shimmer = require('shimmer')
const sparkToJSON = require('spark-to-json')
const toArray = require('to-array')

// "fatal" (60): The service/app is going to stop or become unusable now. An operator should definitely look into this soon.
// "error" (50): Fatal for a particular request, but the service/app continues servicing other requests. An operator should look at this soon(ish).
// "warn"  (40): A note on something that should probably be looked at by an operator eventually.
// "info"  (30): Detail on regular operation.
// "debug" (20): Anything else, i.e. too verbose to be included in "info" level.
// "trace" (10): Logging from external libraries used by your app or very detailed application logging.
const opts = {
  name: process.env.APP_NAME,
  serializers: {
    ctx: (ctx) => (ctx && ctx.url)
      ? pick(ctx, ['method', 'url', 'body', 'headers', 'id', 'token', 'me'])
      : pick(ctx, ['id', 'token', 'me']),
    err: errToJSON,
    req: reqToJSON,
    spark: sparkToJSON
  }
}
const streams = opts.streams = []
if (process.env.APP_LOG_LEVEL) {
  streams.push({
    stream: process.stdout,
    level: process.env.APP_LOG_LEVEL
  })
}
if (process.env.ENABLE_GCLOUD_ERROR) {
  // note: require must be runtime, bc this file requires env vars
  streams.push(require('./lib/gcloud-stream'))
}
if (process.env.SENTRY_DSN) {
  // note: require must be runtime, bc this file requires env vars
  streams.push(require('./lib/sentry-stream'))
}
const log = module.exports = bunyan.createLogger(opts)
log.on('error', function (err) {
  console.error('log error!')
  console.error(err)
})

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
        // args are reversed.. swap them
        tmp = msg
        msg = obj
        obj = tmp
      }
      // default log values
      Object.assign(obj, {
        env: process.env.NODE_ENV,
        commit: process.env.APP_GIT_COMMIT,
        version: process.env.APP_VERSION
      })
      return orig.call(this, obj, msg)
    }
  })
})
