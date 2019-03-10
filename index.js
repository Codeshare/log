'use strict'

require('@codeshare/env').assert([
  'APP_LOG_LEVEL',
  'APP_NAME',
  'ENABLE_GCLOUD_LOG'
])

const AppError = require('codeshare-error')
const bunyan = require('bunyan')
const errToJSON = require('error-to-json')
const { LoggingBunyan } = require('@google-cloud/logging-bunyan')
const pick = require('101/pick')
const reqToJSON = require('request-to-json')
const shimmer = require('shimmer')
const sparkToJSON = require('spark-to-json')

// "fatal" (60): The service/app is going to stop or become unusable now. An operator should definitely look into this soon.
// "error" (50): Fatal for a particular request, but the service/app continues servicing other requests. An operator should look at this soon(ish).
// "warn"  (40): A note on something that should probably be looked at by an operator eventually.
// "info"  (30): Detail on regular operation.
// "debug" (20): Anything else, i.e. too verbose to be included in "info" level.
// "trace" (10): Logging from external libraries used by your app or very detailed application logging.
const LOG_LEVEL = process.env.APP_LOG_LEVEL || 'fatal'
// hardcode for now..
const TRACE_CONTEXT_HEADER_NAME = 'x-cloud-trace-context'

const log = module.exports = bunyan.createLogger({
  name: process.env.APP_NAME,
  level: LOG_LEVEL,
  serializers: {
    ctx: pick(['token', 'me', 'session.token', 'session.user']),
    err: errToJSON,
    req: reqToJSON,
    proxyReq: reqToJSON,
    spark: sparkToJSON
  },
  streams: process.env.ENABLE_GCLOUD_LOG
    // log to google-cloud
    ? [
      new LoggingBunyan({
        logName: process.env.APP_NAME,
        serviceContext: {
          service: process.env.APP_NAME,
          version: process.env.APP_VERSION
        }
      }).stream(),
      {
        level: 'fatal',
        stream: process.stdout
      }
    ]
    // log to stdout
    : [
      {
        stream: process.stdout
      }
    ]
})

log.on('error', function (err) {
  console.error(new AppError(500, 'LOG ERROR!', err))
})

let logEnded = false

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
      if (logEnded) console.log('STREAM ENDED BEFORE:', msg)
      // allows for args in any order..
      let tmp
      if (obj && typeof obj === 'string') {
        // args are reversed.. swap them
        tmp = msg
        msg = obj
        obj = tmp
      }
      obj = obj || {}
      // default log values
      Object.assign(obj, {
        env: process.env.NODE_ENV,
        commit: process.env.APP_GIT_COMMIT,
        version: process.env.APP_VERSION
      })
      // pick req off ctx if it exists
      if (obj.ctx && obj.ctx.req && !obj.req) {
        obj.req = obj.ctx.req
      }
      // pick trace key off of header
      const traceKey = obj.req && obj.req.headers && obj.req.headers[TRACE_CONTEXT_HEADER_NAME]
      if (traceKey) {
        obj[LoggingBunyan.LOGGING_TRACE_KEY] = traceKey
      }
      return orig.call(this, obj, msg)
    }
  })
})

log.logRequest = function (obj) {
  obj = obj || {}
  // pick req off ctx if it exists
  if (obj.ctx && obj.ctx.req && !obj.req) {
    obj.req = obj.ctx.req
  }
  // stackdriver http request logging
  if (obj.req) {
    const ctx = obj.ctx || {}
    const req = obj.req
    const res = ctx.res || {}
    const headers = req.headers || {}
    const connection = req.connection || {}
    const socket = req.socket || connection.socket || {}
    const remoteIp =
      headers['x-forwarded-for'] ||
      connection.remoteAddress ||
      socket.remoteAddress
    const httpRequest = {
      requestMethod: req.method || ctx.method,
      requestUrl: req.url || ctx.url,
      // requestSize: int64,
      status: res.statusCode || ctx.status,
      // responseSize: int64,
      remoteIp: remoteIp,
      serverIp: socket.localAddress,
      referer: headers['referer'],
      userAgent: headers['user-agent'],
      // latency: Duration,
      // cacheLookup: bool,
      // cacheHit: bool,
      // cacheValidatedWithOriginServer: bool,
      // cacheFillBytes: int64,
      protocol: 'HTTP/1.1'
    }
    obj.httpRequest = obj.httpRequest
      ? Object.assign(httpRequest, obj.httpRequest)
      : httpRequest
  }
  log.info('http request', obj)
}

let keepAliveTimer = null
function keepAlive (check) {
  keepAliveTimer = setTimeout(function () {
    if (!check()) keepAlive(check)
  }, 1000)
}

log.end = function () {
  const unFinishedStreams = []
  log.streams.forEach(s => {
    if (!s.stream) return
    if (s.stream === process.stdout) return
    if (s.stream === process.stderr) return
    unFinishedStreams.push(s.stream)
  })
  return Promise.all(unFinishedStreams.map(function (stream) {
    return new Promise(function (resolve) {
      if (stream.finished) return resolve()
      keepAlive(function () {
        return stream.finished
      })
      stream.on('finish', function () {
        clearTimeout(keepAliveTimer)
        resolve()
      })
      logEnded = true
      stream.end()
    })
  }))
}
