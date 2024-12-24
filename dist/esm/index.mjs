import BaseError from 'baseerr';
import Bunyan from 'bunyan';
import { LoggingBunyan } from '@google-cloud/logging-bunyan';
import errToJSON from 'error-to-json';
import { get } from '@codeshare/env';
import reqToJSON from 'request-to-json';
import sparkToJSON from 'spark-to-json';
let keepAliveTimer;
function keepAlive(check) {
    keepAliveTimer = setTimeout(function () {
        if (!check())
            keepAlive(check);
    }, 1000);
}
class LoggerError extends BaseError {
}
var levels;
(function (levels) {
    levels["fatal"] = "fatal";
    levels["error"] = "error";
    levels["warn"] = "warn";
    levels["info"] = "info";
    levels["debug"] = "debug";
    levels["trace"] = "trace";
})(levels || (levels = {}));
const level = get('APP_LOG_LEVEL')
    .default('fatal')
    .asEnum(Object.values(levels));
class Logger extends Bunyan {
    constructor() {
        super({
            name: get('APP_NAME').required().asString(),
            level,
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
        });
        this.logEnded = false;
        this.on('error', (err) => console.error(LoggerError.wrap(err, 'LOG ERROR!')));
    }
    // @ts-ignore
    fatal(msg, data) {
        if (this.logEnded)
            console.log('STREAM ENDED BEFORE: fatal:', msg, data);
        super.fatal(data || {}, msg);
    }
    // @ts-ignore
    error(msg, data) {
        if (this.logEnded)
            console.log('STREAM ENDED BEFORE: error:', msg, data);
        super.error(data || {}, msg);
    }
    // @ts-ignore
    warn(msg, data) {
        if (this.logEnded)
            console.log('STREAM ENDED BEFORE: warn:', msg, data);
        super.warn(data || {}, msg);
    }
    // @ts-ignore
    info(msg, data) {
        if (this.logEnded)
            console.log('STREAM ENDED BEFORE: info:', msg, data);
        super.info(data || {}, msg);
    }
    // @ts-ignore
    debug(msg, data) {
        if (this.logEnded)
            console.log('STREAM ENDED BEFORE: debug:', msg, data);
        super.debug(data || {}, msg);
    }
    // @ts-ignore
    trace(msg, data) {
        if (this.logEnded)
            console.log('STREAM ENDED BEFORE: trace:', msg, data);
        super.trace(data || {}, msg);
    }
    async end() {
        this.logEnded = true;
        const unFinishedStreams = [];
        this.streams.forEach((s) => {
            if (!s.stream)
                return;
            if (s.stream === process.stdout)
                return;
            if (s.stream === process.stderr)
                return;
            unFinishedStreams.push(s.stream);
        });
        await Promise.all(unFinishedStreams.map(function (stream) {
            return new Promise(function (resolve) {
                if (stream.writableFinished)
                    return resolve();
                keepAlive(function () {
                    return stream.writableFinished;
                });
                stream.on('finish', function () {
                    if (keepAliveTimer != null)
                        clearTimeout(keepAliveTimer);
                    resolve();
                });
                stream.end();
            });
        }));
    }
}
export default new Logger();
function ctxToJSON({ token, me, session }) {
    const json = {
        token,
        me,
    };
    if (session) {
        json.session = {
            token: session.token,
            user: session.user,
        };
    }
    return json;
}
function wrapNullishGuard(fn) {
    return function (v) {
        if (v == null)
            return v;
        return fn(v);
    };
}
//# sourceMappingURL=index.js.map