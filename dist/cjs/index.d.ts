/// <reference types="node" />
import Bunyan from 'bunyan';
import { Writable } from 'stream';
declare class Logger extends Bunyan {
    streams: Array<{
        stream: Writable;
    }>;
    logEnded: boolean;
    constructor();
    fatal(msg: string, data?: {}): void;
    error(msg: string, data?: {}): void;
    warn(msg: string, data?: {}): void;
    info(msg: string, data?: {}): void;
    debug(msg: string, data?: {}): void;
    trace(msg: string, data?: {}): void;
    end(): Promise<void>;
}
declare const _default: Logger;
export default _default;
