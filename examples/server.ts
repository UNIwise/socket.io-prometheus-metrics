import express from "express";
import { createServer } from "http";
import * as sio from "socket.io";

import { collectSocketIOMetrics } from "../src";

// Initialize express and socket.io

const app = express();
const server = createServer(app);
const io = sio(server);

// Initialize the Socket.IO metrics collector

const register = collectSocketIOMetrics({ io });

// Start the express server

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

console.log("Metrics exposed on localhost:3000/metrics");

server.listen(3000);
