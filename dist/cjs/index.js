"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const baseerr_1 = __importDefault(require("baseerr"));
const bunyan_1 = __importDefault(require("bunyan"));
const logging_bunyan_1 = require("@google-cloud/logging-bunyan");
const error_to_json_1 = __importDefault(require("error-to-json"));
const env_1 = require("@codeshare/env");
const request_to_json_1 = __importDefault(require("request-to-json"));
const spark_to_json_1 = __importDefault(require("spark-to-json"));
let keepAliveTimer;
function keepAlive(check) {
    keepAliveTimer = setTimeout(function () {
        if (!check())
            keepAlive(check);
    }, 1000);
}
class LoggerError extends baseerr_1.default {
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
const level = env_1.get('APP_LOG_LEVEL')
    .default('fatal')
    .asEnum(Object.values(levels));
class Logger extends bunyan_1.default {
    constructor() {
        super({
            name: env_1.get('APP_NAME').required().asString(),
            level,
            serializers: {
                ctx: wrapNullishGuard(ctxToJSON),
                err: wrapNullishGuard(error_to_json_1.default),
                req: wrapNullishGuard(request_to_json_1.default),
                proxyReq: wrapNullishGuard(request_to_json_1.default),
                spark: wrapNullishGuard(spark_to_json_1.default),
            },
            streams: env_1.get('ENABLE_GCLOUD_LOG').asBool()
                ? // log to google-cloud
                    [
                        new logging_bunyan_1.LoggingBunyan({
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
    end() {
        return __awaiter(this, void 0, void 0, function* () {
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
            yield Promise.all(unFinishedStreams.map(function (stream) {
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
        });
    }
}
exports.default = new Logger();
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