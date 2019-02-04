import * as http from 'http';
import * as express from 'express';
import * as io from 'socket.io';
import * as prom from 'prom-client';

export function metrics(ioServer: io.Server, options?: IMetricsOptions) {
    return new SocketIOMetrics(ioServer, options);
}

export interface IMetricsOptions {
    port?: number | string;
    path?: string;
    createServer?: boolean,
    collectDefaultMetrics?: boolean
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
    public metrics: IMetrics;
    
    private ioServer: io.Server;
    private express: express.Express;
    private expressServer: http.Server;

    private options: IMetricsOptions;

    private defaultOptions: IMetricsOptions = {
        port: 9090,
        path: '/metrics',
        createServer: true,
        collectDefaultMetrics: false
    };

    constructor(ioServer: io.Server, options?: IMetricsOptions) {
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
        this.expressServer = this.express.listen(this.options.port);
        this.express.get(this.options.path, (req: express.Request, res: express.Response) => {
            res.set('Content-Type', this.register.contentType);
            res.end(this.register.metrics());
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
                help: 'Total count of socket.io connection requests'
            }),

            disconnectTotal: new prom.Counter({
                name: 'socket_io_disconnect_total',
                help: 'Total count of socket.io disconnections'
            }),

            eventsReceivedTotal: new prom.Counter({
                name: 'socket_io_events_received_total',
                help: 'Total count of socket.io recieved events',
                labelNames: ['event']
            }),

            eventsSentTotal: new prom.Counter({
                name: 'socket_io_events_sent_total',
                help: 'Total count of socket.io sent events',
                labelNames: ['event']
            }),

            bytesReceived: new prom.Counter({
                name: 'socket_io_recieve_bytes',
                help: 'Total socket.io bytes recieved',
                labelNames: ['event']
            }),

            bytesTransmitted: new prom.Counter({
                name: 'socket_io_transmit_bytes',
                help: 'Total socket.io bytes transmitted',
                labelNames: ['event']
            }),

            errorsTotal: new prom.Counter({
                name: 'socket_io_errors_total',
                help: 'Total socket.io errors'
            })
        };
    }

    private bindMetrics() {
        const blacklisted_events = new Set([
            'error',
            'connect',
            'disconnect',
            'disconnecting',
            'newListener',
            'removeListener'
        ]);

        this.ioServer.on('connect', (socket: any) => {
            // Connect events
            this.metrics.connectTotal.inc();
            this.metrics.connectedSockets.inc();

            // Disconnect events
            socket.on('disconnect', () => {
                this.metrics.connectedSockets.dec();
                this.metrics.disconnectTotal.inc();
            });

            // Hook into emit (outgoing event)
            const org_emit = socket.emit;
            socket.emit = (event: string, ...data: any[]) => {
                if (!blacklisted_events.has(event)) {
                    this.metrics.bytesTransmitted.labels(event).inc(this.dataToBytes(data));
                    this.metrics.eventsSentTotal.labels(event).inc();
                }

                return org_emit.apply(socket, [event, ...data]);
            };

            // Hook into onevent (incoming event)
            const org_onevent = socket.onevent;
            socket.onevent = (packet: any) => {
                if (packet && packet.data) {
                    const [event, data] = packet.data;

                    if (event === 'error') {
                        this.metrics.errorsTotal.inc();
                    } else if (!blacklisted_events.has(event)) {
                        this.metrics.bytesReceived.labels(event).inc(this.dataToBytes(data));
                        this.metrics.eventsReceivedTotal.labels(event).inc();
                    }
                }

                return org_onevent.bind(socket, packet);
            };
        });
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