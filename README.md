# socket.io-prometheus-metrics

Exposes a metrics endpoint for prometheus to collect data about [`socket.io`](https://github.com/socketio/socket.io).

## Installation

```bash
npm install socket.io-prometheus-metrics
# or
yarn add socket.io-prometheus-metrics
```

## Usage

Basic usage

```ts
import * as http from 'http';
import * as io from 'socket.io';
import * as prometheus from 'socket.io-prometheus-metrics';

const server = http.createServer();
const io = io(server);

prometheus.metrics(io);

server.listen(3000);
```
Metrics is then available at `localhost:9090/metrics`.

Prometheus default metrics can also be enabled by setting the `collectDefaultMetrics` option to `true`

```ts
prometheus.metrics(io, {
    collectDefaultMetrics: true
});
```

If you wish to serve the metrics yourself the `createServer` options can be set to `false` and metrics can be collected from the register
```ts
const ioMetrics = prometheus.metrics(io, {
    createServer: false
});

const metrics = ioMetrics.register.metrics();
```

## Options

| Option                    | Default       | Description                                                  |
| ------------------------- | --------------| ------------------------------------------------------------ |
| `path`                    | "/metrics"    | Metrics path                                                 |
| `port`                    | 9090          | Metrics port                                                 |
| `createServer`            | true          | Auto create http server                                      |
| `collectDefaultMetrics`   | false         | Collect prometheus default metrics                           |
| `checkForNewNamespaces`   | true          | Collect metrics for namespaces that will be added at runtime |

## Socket.io metrics

> all metrics have `socket_io_` prefix in their names.

| Name                              | Help                                         | Labels               |
| --------------------------------- | ---------------------------------------------| -------------------  |
| `socket_io_connected`             | Number of currently connected sockets        |                      |
| `socket_io_connect_total`         | Total count of socket.io connection requests | `namespace`          |
| `socket_io_disconnect_total`      | Total count of socket.io disconnections      | `namespace`          |
| `socket_io_errors_total`          | Total count of socket.io errors              | `namespace`          |
| `socket_io_events_received_total` | Total count of socket.io received events     | `event`, `namespace` |
| `socket_io_events_sent_total`     | Total count of socket.io sent events         | `event`, `namespace` |
| `socket_io_receive_bytes`         | Total socket.io bytes received               | `event`, `namespace` |
| `socket_io_transmit_bytes`        | Total socket.io bytes transmitted            | `event`, `namespace` |

## Prometheus default metrics
> available if `collectDefaultMetrics` is set to `true`

More information [here](https://github.com/siimon/prom-client#default-metrics) and [here](https://prometheus.io/docs/instrumenting/writing_clientlibs/#standard-and-runtime-collectors).

## Namespaces support

Default namespace has label value of `'/'`.

By default library checks `io.nsps` variable for new namespaces to collect metrics from. This check occurs every 2 seconds. 

You can disable this functionality by providing `checkForNewNamespaces` option with `false` value.
For example:

```ts
prometheus.metrics(io, {
    checkForNewNamespaces: false
});
```

With this functionality disabled, library will only collect metrics from namespaces that 
were available at the moment of call to `prometheus.metrics(io, ...)`, 
default namespace is included.  

More information about socket.io namespaces [here](https://socket.io/docs/rooms-and-namespaces).   

## License

Licensed under the Apache 2.0 License. See the LICENSE file for details.