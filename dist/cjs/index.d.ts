import Bunyan from 'bunyan';
import { Writable } from 'stream';
type LogData = {
    err?: {
        stack?: string;
        [key: string]: any;
    };
    message?: string;
    [key: string]: any;
};
declare class Logger extends Bunyan {
    streams: Array<{
        stream: Writable;
    }>;
    logEnded: boolean;
    constructor();
    fatal(msg: string, data?: LogData): void;
    error(msg: string, data?: LogData): void;
    warn(msg: string, data?: LogData): void;
    info(msg: string, data?: LogData): void;
    debug(msg: string, data?: LogData): void;
    trace(msg: string, data?: LogData): void;
    end(): Promise<void>;
}
declare const logger: Logger;
export default logger;
export declare function log(msg: string, data?: LogData): void;
