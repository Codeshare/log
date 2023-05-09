import BaseError from 'baseerr'
import Bunyan from 'bunyan'
import { LoggingBunyan } from '@google-cloud/logging-bunyan'
import { Writable } from 'stream'
import errToJSON from 'error-to-json'
import { get } from '@codeshare/env'
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

const level = get('APP_LOG_LEVEL')
  .default('fatal')
  .asEnum<levels>(Object.values(levels))

class Logger extends Bunyan {
  // @ts-ignore
  streams: Array<{ stream: Writable }>
  logEnded = false

  constructor() {
    super({
      name: get('APP_NAME').required().asString(),
      level,
      serializers: {
        ctx: wrapNullishGuard(ctxToJSON),
        err: wrapNullishGuard(errToJSON),
        req: wrapNullishGuard(reqToJSON),
        proxyReq: wrapNullishGuard(reqToJSON),
        spark: wrapNullishGuard(sparkToJSON),
      },
      streams: get('ENABLE_GCLOUD_LOG').asBool()
        ? // log to google-cloud
          [
            new LoggingBunyan({
              logName: process.env.APP_NAME,
              serviceContext: {
                service: process.env.APP_NAME,
                version: process.env.APP_VERSION,
              },
            }).stream(level),
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
  fatal(msg: string, data?: {}): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: fatal:', msg, data)
    super.fatal(data || {}, msg)
  }
  // @ts-ignore
  error(msg: string, data?: {}): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: error:', msg, data)
    super.error(data || {}, msg)
  }
  // @ts-ignore
  warn(msg: string, data?: {}): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: warn:', msg, data)
    super.warn(data || {}, msg)
  }
  // @ts-ignore
  info(msg: string, data?: {}): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: info:', msg, data)
    super.info(data || {}, msg)
  }
  // @ts-ignore
  debug(msg: string, data?: {}): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: debug:', msg, data)
    super.debug(data || {}, msg)
  }
  // @ts-ignore
  trace(msg: string, data?: {}): void {
    if (this.logEnded) console.log('STREAM ENDED BEFORE: trace:', msg, data)
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
