import * as prom from 'prom-client';

export const Metrics = {
    connectedSockets: new prom.Gauge({
        name: 'socket_io_connected',
        help: 'Number of currently connected clients'
    }),

    connectTotal: new prom.Counter({
        name: 'socket_io_connects',
        help: 'Total count of socket.io connect requests',
        labelNames: ['namespace']
    }),

    disconnectTotal: new prom.Counter({
        name: 'socket_io_disconnects',
        help: 'Total count of socket.io disconnects',
        labelNames: ['namespace']
    }),

    errorsTotal: new prom.Counter({
        name: 'socket_io_errors',
        help: 'Total count of socket.io errors',
        labelNames: ['namespace']
    }),

    eventsReceivedTotal: new prom.Counter({
        name: 'socket_io_events_received',
        help: 'Total count of socket.io events received',
        labelNames: ['event', 'namespace']
    }),

    eventsSentTotal: new prom.Counter({
        name: 'socket_io_events_sent',
        help: 'Total count of socket.io events sent',
        labelNames: ['event', 'namespace']
    }),

    bytesReceived: new prom.Counter({
        name: 'socket_io_bytes_received',
        help: 'Total count of socket.io bytes received',
        labelNames: ['event', 'namespace']
    }),

    bytesTransmitted: new prom.Counter({
        name: 'socket_io_bytes_sent',
        help: 'Total count of socket.io bytes sent',
        labelNames: ['event', 'namespace']
    })
}