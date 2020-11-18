import * as prom from "prom-client";
import * as io from "socket.io";

export function collectDefault(register: prom.Registry, prefix: string): void {
  prom.collectDefaultMetrics({
    register: register,
    prefix: prefix
  });
}

export function collectSocketIO(io: io.Server, register: prom.Registry, prefix: string): void {
  // TODO
  
  return;
}