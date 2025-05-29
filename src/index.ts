import BaseError from 'baseerr'
import Bunyan from 'bunyan'
import { LoggingBunyan } from '@google-cloud/logging-bunyan'
import { Writable } from 'stream'
import errToJSON from 'error-to-json'
import { get } from 'env-var'
import reqToJSON from 'request-to-json'
import sparkToJSON from 'spark-to-json'

let keepAliveTimer: NodeJS.Timer | undefined
function keepAlive(check: Function) {
  keepAliveTimer = setTimeout(function () {
    if (!check()) keepAlive(check)
  }, 1000)
}

class LoggerError extends BaseError<{}> {}

enum levels {
  'fatal' = 'fatal',
  'error' = 'error',
  'warn' = 'warn',
  'info' = 'info',
  'debug' = 'debug',
  'trace' = 'trace',
}

const APP_NAME = get('APP_NAME').required().asString()
const APP_VERSION = get('APP_VERSION').default('unknown').asString()
const APP_LOG_LEVEL = get('APP_LOG_LEVEL')
  .default('fatal')
  .asEnum<levels>(Object.values(levels))
const ENABLE_GCLOUD_LOG = get('ENABLE_GCLOUD_LOG').default('false').asBool()

type LogData = {
  err?: {
    stack?: string
    [key: string]: any
  }
  message?: string
  [key: string]: any
}

class Logger extends Bunyan {
  // @ts-ignore
  streams: Array<{ stream: Writable }>
  logEnded = false

  constructor() {
    super({
      name: APP_NAME,
      level: APP_LOG_LEVEL,
      serializers: {
        ctx: wrapNullishGuard(ctxToJSON),
        err: wrapNullishGuard(errToJSON),
        apiErr: wrapNullishGuard(errToJSON),
        graphqlErr: wrapNullishGuard(errToJSON),
        sourceErr: wrapNullishGuard(errToJSON),
        originalErr: wrapNullishGuard(errToJSON),
        req: wrapNullishGuard(reqToJSON),
        proxyReq: wrapNullishGuard(reqToJSON),
        spark: wrapNullishGuard(sparkToJSON),
      },
      streams: ENABLE_GCLOUD_LOG
        ? // log to google-cloud
          [
            new LoggingBunyan({
              logName: APP_NAME,
              serviceContext: {
                service: APP_NAME,
                version: APP_VERSION,
              },
            }).stream(APP_LOG_LEVEL),
            {
              level: 'fatal',
              stream: process.stdout,
            },
          ]
        : // log to stdout
          [
            {
              stream: process.stdout,
            },
          ],
    })
    this.on('error', (err: Error) =>
      console.error(LoggerError.wrap(err, 'LOG ERROR!')),
    )
  }

  // @ts-ignore
  fatal(msg: string, data?: LogData): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: fatal:', msg, data)
    gcloudErrorDataTransform(data)
    super.fatal(data || {}, msg)
  }
  // @ts-ignore
  error(msg: string, data?: LogData): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: error:', msg, data)
    gcloudErrorDataTransform(data)
    super.error(data || {}, msg)
  }
  // @ts-ignore
  warn(msg: string, data?: LogData): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: warn:', msg, data)
    gcloudErrorDataTransform(data)
    super.warn(data || {}, msg)
  }
  // @ts-ignore
  info(msg: string, data?: LogData): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: info:', msg, data)
    gcloudErrorDataTransform(data)
    super.info(data || {}, msg)
  }
  // @ts-ignore
  debug(msg: string, data?: LogData): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: debug:', msg, data)
    gcloudErrorDataTransform(data)
    super.debug(data || {}, msg)
  }
  // @ts-ignore
  trace(msg: string, data?: LogData): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: trace:', msg, data)
    gcloudErrorDataTransform(data)
    super.trace(data || {}, msg)
  }

  async end() {
    this.logEnded = true
    const unFinishedStreams: Array<Writable> = []
    this.streams.forEach((s) => {
      if (!s.stream) return
      if (s.stream === process.stdout) return
      if (s.stream === process.stderr) return
      unFinishedStreams.push(s.stream)
    })
    await Promise.all(
      unFinishedStreams.map(function (stream) {
        return new Promise<void>(function (resolve) {
          if (stream.writableFinished) return resolve()
          keepAlive(function () {
            return stream.writableFinished
          })
          stream.on('finish', function () {
            if (keepAliveTimer != null) clearTimeout(keepAliveTimer)
            resolve()
          })
          stream.end()
        })
      }),
    )
  }
}

export default new Logger()

function gcloudErrorDataTransform(data: LogData) {
  if (ENABLE_GCLOUD_LOG) {
    // modify error properties to prevent redundancy
    if (data?.err?.stack) {
      data.message = data.err.stack
      data.err.stack = undefined
      delete data.err.stack
    }
  }
}

type Ctx = {
  token?: string
  me?: {}
  session?: {
    token?: string
    user?: {}
  }
}
function ctxToJSON({ token, me, session }: Ctx) {
  const json: Ctx = {
    token,
    me,
  }
  if (session) {
    json.session = {
      token: session.token,
      user: session.user,
    }
  }
  return json
}

function wrapNullishGuard<V, R>(fn: (v: V) => R) {
  return function (v: V | undefined | null): R | undefined | null {
    if (v == null) return v as null
    return fn(v)
  }
}
