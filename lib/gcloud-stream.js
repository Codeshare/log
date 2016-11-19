'use strict'

const env = require('@codeshare/env')
env.assert([
  'NODE_ENV',
  'APP_NAME',
  'APP_VERSION'
])

const bunyan = require('bunyan')
const client = require('@google/cloud-errors').start({
  reportUncaughtExceptions: false,
  serviceContext: {
    service: process.env.APP_NAME,
    version: process.env.APP_VERSION
  }
})
const errToJSON = require('error-to-json')
const kp = require('keypather')()
const ReqContainer = require('@google/cloud-errors/lib/classes/request-information-container.js')
const through2 = require('through2')

const levelToName = {
  60: 'fatal',
  50: 'error',
  40: 'warn',
  30: 'info',
  20: 'debug',
  10: 'trace'
}

module.exports = {
  type: 'raw',
  level: bunyan.ERROR,
  stream: through2.obj(function (logObj, enc, cb) {
    if (logObj.err && !kp.get(logObj, 'err.data.dontReport')) {
      const ctx = logObj.ctx || {}
      const userId = kp.get(ctx, 'me.id')
      let reqContainer
      if (ctx.req) {
        reqContainer = new RequestContainer()
        reqContainer.setMethod(ctx.req.method)
        reqContainer.setUrl(ctx.req.url)
        reqContainer.setUserAgent(ctx.req.headers['user-agent'])
        reqContainer.setReferrer(ctx.req.headers['referrer'] || ctx.req.headers['referer'])
        if (ctx.req.socket && ctx.req.socket.remoteAddress) {
          reqContainer.setRemoteAddress(ctx.req.socket.remoteAddress)
        }
      } else if (ctx.spark && ctx.rootSpanData) {
        reqContainer = new RequestContainer()
        reqContainer.setMethod('GET')
        reqContainer.setUrl(kp.get(ctx.rootSpanData, 'spanData.name'))
        reqContainer.setRemoteAddress(ctx.spark.headers['x-forwarded-for'] || ctx.spark.remote)
      }
      if (reqContainer) {
        reqContainer.setStatusCode(logObj.err.statusCode || 500)
      }
      logObj.err.stack += '---\nlog.error: ' + logObj.msg
      console.log('REPORT', logObj.err, reqContainer, null, userId, !!cb)
      // client.report(logObj.err, reqContainer, logObj.msg, userId, cb)
      cb()
    } else {
      cb()
    }
  })
}
