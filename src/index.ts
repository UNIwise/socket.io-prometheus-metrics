import * as http from "http";
import * as express from "express";
import * as io from "socket.io";
import * as prom from "prom-client";

import { Metrics } from "./metrics";

export function collect(
  ioServer: io.Server,
  options?: IMetricsOptions
): SocketIOMetrics {
  return new SocketIOMetrics(ioServer, options);
}

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

export const DefaultOptions: IMetricsOptions = {
  port: 9090,
  path: "/metrics",
  createServer: true,
  collectDefaultMetrics: false,
  checkForNewNamespaces: true,
  prefix: 'socket_io'
};

export class SocketIOMetrics {
  public server: http.Server | null;
  
  private register: prom.Registry;
  private metrics: IMetrics;
  private ioServer: io.Server;
  private express: express.Express;

  private options: IMetricsOptions;

  private boundNamespaces = new Set();

  constructor(io: io.Server, options?: IMetricsOptions) {
    this.options = { ...DefaultOptions, ...options };
    
    this.ioServer = io;
    
    this.register = prom.register;
    this.metrics = Metrics(this.options.prefix);

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
    } else {
      this.server = null;
    }
  }

  /*
   * Metrics Server
   */

  private initServer() {
    this.express = express();
    this.server = this.express.listen(this.options.port);
    this.express.get(
      this.options.path,
      (req: express.Request, res: express.Response) => {
        res.set("Content-Type", this.register.contentType);
        res.end(this.register.metrics());
      }
    );
  }

  public getMetrics(opts?: prom.MetricsOpts): string {
    return this.register.metrics(opts);
  }

  /*
   * Metrics logic
   */

  private bindMetricsOnEmitter(
    server: NodeJS.EventEmitter,
    labels: prom.labelValues
  ) {
    const blacklisted_events = new Set([
      "error",
      "connect",
      "disconnect",
      "disconnecting",
      "newListener",
      "removeListener",
    ]);

    server.on("connect", (socket: any) => {
      // Connect events
      this.metrics.connectTotal.inc(labels);
      this.metrics.connectedSockets.set(
        (this.ioServer.engine as any).clientsCount
      );

      // Disconnect events
      socket.on("disconnect", () => {
        this.metrics.disconnectTotal.inc(labels);
        this.metrics.connectedSockets.set(
          (this.ioServer.engine as any).clientsCount
        );
      });

      // Hook into emit (outgoing event)
      const org_emit = socket.emit;
      socket.emit = (event: string, ...data: any[]) => {
        if (!blacklisted_events.has(event)) {
          const labelsWithEvent = { event: event, ...labels };
          this.metrics.bytesTransmitted.inc(
            labelsWithEvent,
            this.dataToBytes(data)
          );
          this.metrics.eventsSentTotal.inc(labelsWithEvent);
        }

        return org_emit.apply(socket, [event, ...data]);
      };

      // Hook into onevent (incoming event)
      const org_onevent = socket.onevent;
      socket.onevent = (packet: any) => {
        if (packet && packet.data) {
          const [event, data] = packet.data;

          if (event === "error") {
            this.metrics.connectedSockets.set(
              (this.ioServer.engine as any).clientsCount
            );
            this.metrics.errorsTotal.inc(labels);
          } else if (!blacklisted_events.has(event)) {
            const labelsWithEvent = { event: event, ...labels };
            this.metrics.bytesReceived.inc(
              labelsWithEvent,
              this.dataToBytes(data)
            );
            this.metrics.eventsReceivedTotal.inc(labelsWithEvent);
          }
        }

        return org_onevent.call(socket, packet);
      };
    });
  }

  private bindNamespaceMetrics(server: io.Server, namespace: string) {
    if (this.boundNamespaces.has(namespace)) {
      return;
    }
    const namespaceServer = server.of(namespace);
    this.bindMetricsOnEmitter(namespaceServer, { namespace: namespace });
    this.boundNamespaces.add(namespace);
  }

  private bindMetrics() {
    Object.keys(this.ioServer.nsps).forEach((nsp) =>
      this.bindNamespaceMetrics(this.ioServer, nsp)
    );

    if (this.options.checkForNewNamespaces) {
      setInterval(() => {
        Object.keys(this.ioServer.nsps).forEach((nsp) =>
          this.bindNamespaceMetrics(this.ioServer, nsp)
        );
      }, 2000);
    }
  }

  /*
   * Helping methods
   */

  private dataToBytes(data: any) {
    try {
      return Buffer.byteLength(
        typeof data === "string" ? data : JSON.stringify(data) || "",
        "utf8"
      );
    } catch (e) {
      return 0;
    }
  }
}
