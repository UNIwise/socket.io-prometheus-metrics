import { Registry, register } from "prom-client";
import * as io from "socket.io";

import { collectDefault, collectSocketIO } from "./collectors";

export interface ICollectMetricsConfig {
  /**
   * The io server to collect metrics from
   */
  io: io.Server;

  /**
   * Override the registry to use
   * @default null
   */
  register?: Registry | null

  /**
   * Prefix your metrics with a string
   * i.e. "foo" would result in foo_socket_io_...
   * @default null
   * 
   */
  prefix?: string | null;

  /**
   * Should this collect also collect default metrics?
   * @default false
   */
  collectDefaultMetrics?: boolean;
}

export function collectSocketIOMetrics(options: ICollectMetricsConfig): Registry {
  const r = options.register ? options.register : register; 

  if (options.collectDefaultMetrics) {
    collectDefault(r, options.prefix);
  }

  collectSocketIO(options.io, r, options.prefix)

  return r;
}