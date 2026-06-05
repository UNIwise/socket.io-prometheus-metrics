import * as http from 'http';
import express from 'express';
import { Server, Socket } from 'socket.io';
import * as prom from 'prom-client';

export function metrics(ioServer: Server, options?: IMetricsOptions) {
    return new SocketIOMetrics(ioServer, options);
}

export interface IMetricsOptions {
    port?: number | string;
    path?: string;
    createServer?: boolean,
    collectDefaultMetrics?: boolean
    checkForNewNamespaces?: boolean
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

export class SocketIOMetrics {
    public register: prom.Registry;
    public metrics!: IMetrics;

    private ioServer: Server;
    private express: express.Express;
    private expressServer: http.Server;

    private options: IMetricsOptions;

    private boundNamespaces = new Set<string>();

    private defaultOptions: IMetricsOptions = {
        port: 9090,
        path: '/metrics',
        createServer: true,
        collectDefaultMetrics: false,
        checkForNewNamespaces: true
    };

    constructor(ioServer: Server, options?: IMetricsOptions) {
        this.options = { ...this.defaultOptions, ...options };
        this.ioServer = ioServer;
        this.register = prom.register;

        this.initMetrics();
        this.bindMetrics();

        if (this.options.collectDefaultMetrics) {
            prom.collectDefaultMetrics({
                register: this.register
            });
        }

        if (this.options.createServer) {
            this.start();
        }
    }

    /*
    * Metrics Server
    */

    public start() {
        if (!this.expressServer || !this.expressServer.listening) {
            this.initServer();
        }
    }

    public async close() {
        return this.expressServer.close();
    }

    private initServer() {
        this.express = express();
        this.expressServer = this.express.listen(this.options.port ?? this.defaultOptions.port);
        this.express.get(this.options.path ?? this.defaultOptions.path!, async (_req: express.Request, res: express.Response) => {
            res.set('Content-Type', this.register.contentType);
            res.end(await this.register.metrics());
        });
    }

    /*
    * Metrics logic
    */

    private initMetrics() {
        this.metrics = {
            connectedSockets: new prom.Gauge({
                name: 'socket_io_connected',
                help: 'Number of currently connected sockets'
            }),

            connectTotal: new prom.Counter({
                name: 'socket_io_connect_total',
                help: 'Total count of socket.io connection requests',
                labelNames: ['namespace']
            }),

            disconnectTotal: new prom.Counter({
                name: 'socket_io_disconnect_total',
                help: 'Total count of socket.io disconnections',
                labelNames: ['namespace']
            }),

            eventsReceivedTotal: new prom.Counter({
                name: 'socket_io_events_received_total',
                help: 'Total count of socket.io received events',
                labelNames: ['event', 'namespace']
            }),

            eventsSentTotal: new prom.Counter({
                name: 'socket_io_events_sent_total',
                help: 'Total count of socket.io sent events',
                labelNames: ['event', 'namespace']
            }),

            bytesReceived: new prom.Counter({
                name: 'socket_io_receive_bytes',
                help: 'Total socket.io bytes received',
                labelNames: ['event', 'namespace']
            }),

            bytesTransmitted: new prom.Counter({
                name: 'socket_io_transmit_bytes',
                help: 'Total socket.io bytes transmitted',
                labelNames: ['event', 'namespace']
            }),

            errorsTotal: new prom.Counter({
                name: 'socket_io_errors_total',
                help: 'Total socket.io errors',
                labelNames: ['namespace']
            })
        };
    }

    private bindMetricsOnNamespace(namespaceName: string) {
        const blacklisted_events = new Set([
            'error',
            'connect',
            'disconnect',
            'disconnecting',
            'newListener',
            'removeListener'
        ]);

        const labels = { namespace: namespaceName };
        const namespaceServer = this.ioServer.of(namespaceName);

        namespaceServer.on('connect', (socket: Socket) => {
            // Connect events
            this.metrics.connectTotal.inc(labels);
            this.metrics.connectedSockets.set((this.ioServer.engine as any).clientsCount);

            // Disconnect events
            socket.on('disconnect', () => {
                this.metrics.disconnectTotal.inc(labels);
                this.metrics.connectedSockets.set((this.ioServer.engine as any).clientsCount);
            });

            socket.onAnyOutgoing((event: string, ...data: any[]) => {
                if (!blacklisted_events.has(event)) {
                    const labelsWithEvent = { event, ...labels };
                    this.metrics.bytesTransmitted.inc(labelsWithEvent, this.dataToBytes(data));
                    this.metrics.eventsSentTotal.inc(labelsWithEvent);
                }
            });

            socket.onAny((event: string, ...data: any[]) => {
                if (event === 'error') {
                    this.metrics.connectedSockets.set((this.ioServer.engine as any).clientsCount);
                    this.metrics.errorsTotal.inc(labels);
                } else if (!blacklisted_events.has(event)) {
                    const labelsWithEvent = { event, ...labels };
                    this.metrics.bytesReceived.inc(labelsWithEvent, this.dataToBytes(data));
                    this.metrics.eventsReceivedTotal.inc(labelsWithEvent);
                }
            });
        });
    }

    private bindNamespaceMetrics(namespaceName: string) {
        if (this.boundNamespaces.has(namespaceName)) {
            return;
        }
        this.bindMetricsOnNamespace(namespaceName);
        this.boundNamespaces.add(namespaceName);
    }

    private bindMetrics() {
        const nsps = (this.ioServer as any)._nsps;
        if (nsps instanceof Map) {
            nsps.forEach((_: any, name: string) => this.bindNamespaceMetrics(name));
        } else {
            this.bindNamespaceMetrics('/');
        }

        if (this.options.checkForNewNamespaces) {
            this.ioServer.on('new_namespace', (namespace: any) => {
                this.bindNamespaceMetrics(namespace.name);
            });
        }
    }

    /*
    * Helping methods
    */

    private dataToBytes(data: any) {
        try {
            return Buffer.byteLength((typeof data === 'string') ? data : JSON.stringify(data) || '', 'utf8');
        } catch (e) {
            return 0;
        }
    }
}
