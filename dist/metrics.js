"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metrics = void 0;
const prom = require("prom-client");
function Metrics(prefix) {
    return {
        connectedSockets: new prom.Gauge({
            name: prefix + '_connected',
            help: 'Number of currently connected clients'
        }),
        connectTotal: new prom.Counter({
            name: prefix + '_connects',
            help: 'Total count of socket.io connect requests',
            labelNames: ['namespace']
        }),
        disconnectTotal: new prom.Counter({
            name: prefix + '_disconnects',
            help: 'Total count of socket.io disconnects',
            labelNames: ['namespace']
        }),
        errorsTotal: new prom.Counter({
            name: prefix + '_errors',
            help: 'Total count of socket.io errors',
            labelNames: ['namespace']
        }),
        eventsReceivedTotal: new prom.Counter({
            name: prefix + '_events_received',
            help: 'Total count of socket.io events received',
            labelNames: ['event', 'namespace']
        }),
        eventsSentTotal: new prom.Counter({
            name: prefix + '_events_sent',
            help: 'Total count of socket.io events sent',
            labelNames: ['event', 'namespace']
        }),
        bytesReceived: new prom.Counter({
            name: prefix + '_bytes_received',
            help: 'Total count of socket.io bytes received',
            labelNames: ['event', 'namespace']
        }),
        bytesTransmitted: new prom.Counter({
            name: prefix + '_bytes_sent',
            help: 'Total count of socket.io bytes sent',
            labelNames: ['event', 'namespace']
        })
    };
}
exports.Metrics = Metrics;
