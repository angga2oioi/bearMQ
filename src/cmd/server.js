//@ts-check
// server.js

const createHttpServer = require("./../shared/http.router");
const createWebSocketServer = require("./../shared/ws.consumer");

const PORT = process.env.PORT || 3000;

const httpServer = createHttpServer(PORT);
createWebSocketServer(httpServer);
