'use strict'

const env = require('@codeshare/env')
env.assert([
  'NODE_ENV',
  'APP_GIT_SHA',
  'APP_VERSION'
])

const bunyan = require('bunyan')
const errToJSON = require('error-to-json')
const raven = require('raven')
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
    if (logObj.err) {
      const client = new raven.Client(process.env.SENTRY_DSN, {
        environment: process.env.NODE_ENV,
        release: process.env.APP_GIT_SHA,
        level: levelToName[logObj.level],
        extra: logObj
      })
      // set tags
      client.setTagsContext({
        pid: process.pid,
        version: process.env.APP_VERSION
      })
      // add user info, if it exists
      if (logObj.ctx && logObj.ctx.me) {
        const userInfo = pick(logObj.ctx.me, ['id', 'email'])
        client.setUserContext(userInfo)
      }
      // send error to sentry
      const err = errToJSON.parse(logObj.err)
      client.captureException(err)
    }
    cb()
  })
}
