//@ts-check
// consumerSocket.js

const { WebSocketServer } = require('ws');
const queueManager = require("./../internal/queueManager");

let socketIdCounter = 1;

function createWebSocketServer(server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (socket) => {
        socket.id = `ws-${socketIdCounter++}`;

        socket.on('message', (msg) => {
            const payload = JSON.parse(msg?.toString());
            try {
                
                if (payload.type === 'subscribe' && payload.queue) {
                    queueManager.subscribeToQueue(payload.queue, socket);
                }

                if (payload.type === 'ack' && payload.queue && payload.jobId) {
                    queueManager.ackJob(payload.queue, payload.jobId, socket);
                }
            } catch (e) {

                console.error('Invalid WS message:', e);
            }
        });

        socket.on('close', () => {
            // Cleanup is handled inside the MessageQueue class
        });
    });

    console.log('WebSocket server ready');
}

module.exports = createWebSocketServer;
