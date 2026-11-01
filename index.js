const WebSocket = require('ws');
const http = require('http');
const port = process.env.PORT || 3000;
const uuid = process.env.UUID || '';

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server is running');
});

const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', (message) => {
    });
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
