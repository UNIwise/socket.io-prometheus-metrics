/// <reference types="node" />
import * as http from "http";
import * as io from "socket.io";
import * as prom from "prom-client";
export declare function collect(ioServer: io.Server, options?: IMetricsOptions): SocketIOMetrics;
export interface IMetricsOptions {
    port?: number | string;
    path?: string;
    createServer?: boolean;
    collectDefaultMetrics?: boolean;
    checkForNewNamespaces?: boolean;
    prefix?: string;
}
export interface IMetrics {
    connectedSockets: prom.Gauge;
    connectTotal: prom.Counter;
    disconnectTotal: prom.Counter;
    eventsReceivedTotal: prom.Counter;
    eventsSentTotal: prom.Counter;
    bytesReceived: prom.Counter;
    bytesTransmitted: prom.Counter;
    errorsTotal: prom.Counter;
}
export declare const DefaultOptions: IMetricsOptions;
export declare class SocketIOMetrics {
    server: http.Server | null;
    private register;
    private metrics;
    private ioServer;
    private express;
    private options;
    private boundNamespaces;
    constructor(io: io.Server, options?: IMetricsOptions);
    private initServer;
    getMetrics(opts?: prom.MetricsOpts): string;
    private bindMetricsOnEmitter;
    private bindNamespaceMetrics;
    private bindMetrics;
    private dataToBytes;
}
