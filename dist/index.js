"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketIOMetrics = exports.DefaultOptions = exports.collect = void 0;
const express = require("express");
const prom = require("prom-client");
const metrics_1 = require("./metrics");
function collect(ioServer, options) {
    return new SocketIOMetrics(ioServer, options);
}
exports.collect = collect;
exports.DefaultOptions = {
    port: 9090,
    path: "/metrics",
    createServer: true,
    collectDefaultMetrics: false,
    checkForNewNamespaces: true,
    prefix: 'socket_io'
};
class SocketIOMetrics {
    constructor(io, options) {
        this.boundNamespaces = new Set();
        this.options = Object.assign(Object.assign({}, exports.DefaultOptions), options);
        this.ioServer = io;
        this.register = prom.register;
        this.metrics = metrics_1.Metrics(this.options.prefix);
        this.bindMetrics();
        if (this.options.collectDefaultMetrics) {
            prom.collectDefaultMetrics({
                register: this.register,
            });
        }
        if (this.options.createServer) {
            if (!this.server || !this.server.listening) {
                this.initServer();
            }
        }
        else {
            this.server = null;
        }
    }
    initServer() {
        this.express = express();
        this.server = this.express.listen(this.options.port);
        this.express.get(this.options.path, (req, res) => {
            res.set("Content-Type", this.register.contentType);
            res.end(this.register.metrics());
        });
    }
    getMetrics(opts) {
        return this.register.metrics(opts);
    }
    bindMetricsOnEmitter(server, labels) {
        const blacklisted_events = new Set([
            "error",
            "connect",
            "disconnect",
            "disconnecting",
            "newListener",
            "removeListener",
        ]);
        server.on("connect", (socket) => {
            this.metrics.connectTotal.inc(labels);
            this.metrics.connectedSockets.set(this.ioServer.engine.clientsCount);
            socket.on("disconnect", () => {
                this.metrics.disconnectTotal.inc(labels);
                this.metrics.connectedSockets.set(this.ioServer.engine.clientsCount);
            });
            const org_emit = socket.emit;
            socket.emit = (event, ...data) => {
                if (!blacklisted_events.has(event)) {
                    const labelsWithEvent = Object.assign({ event: event }, labels);
                    this.metrics.bytesTransmitted.inc(labelsWithEvent, this.dataToBytes(data));
                    this.metrics.eventsSentTotal.inc(labelsWithEvent);
                }
                return org_emit.apply(socket, [event, ...data]);
            };
            const org_onevent = socket.onevent;
            socket.onevent = (packet) => {
                if (packet && packet.data) {
                    const [event, data] = packet.data;
                    if (event === "error") {
                        this.metrics.connectedSockets.set(this.ioServer.engine.clientsCount);
                        this.metrics.errorsTotal.inc(labels);
                    }
                    else if (!blacklisted_events.has(event)) {
                        const labelsWithEvent = Object.assign({ event: event }, labels);
                        this.metrics.bytesReceived.inc(labelsWithEvent, this.dataToBytes(data));
                        this.metrics.eventsReceivedTotal.inc(labelsWithEvent);
                    }
                }
                return org_onevent.call(socket, packet);
            };
        });
    }
    bindNamespaceMetrics(server, namespace) {
        if (this.boundNamespaces.has(namespace)) {
            return;
        }
        const namespaceServer = server.of(namespace);
        this.bindMetricsOnEmitter(namespaceServer, { namespace: namespace });
        this.boundNamespaces.add(namespace);
    }
    bindMetrics() {
        Object.keys(this.ioServer.nsps).forEach((nsp) => this.bindNamespaceMetrics(this.ioServer, nsp));
        if (this.options.checkForNewNamespaces) {
            setInterval(() => {
                Object.keys(this.ioServer.nsps).forEach((nsp) => this.bindNamespaceMetrics(this.ioServer, nsp));
            }, 2000);
        }
    }
    dataToBytes(data) {
        try {
            return Buffer.byteLength(typeof data === "string" ? data : JSON.stringify(data) || "", "utf8");
        }
        catch (e) {
            return 0;
        }
    }
}
exports.SocketIOMetrics = SocketIOMetrics;
