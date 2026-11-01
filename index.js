const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const net = require('net');

const uuid = (process.env.UUID || '').replace(/-/g, '').toLowerCase();
const port = process.env.PORT || 3000;

if (!uuid) {
    console.error("⚠️ [CONFIG ERROR] UUID is missing! Please set it in Pxxl Secrets.");
    process.exit(1);
}

const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('System Normal');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    ws.once('message', (firstChunk) => {
        try {
            if (firstChunk.length < 18) return ws.close();

            const clientUuid = firstChunk.slice(1, 17).toString('hex');
            if (clientUuid !== uuid) return ws.close();

            let addonLen = firstChunk[17];
            let cursor = 18 + addonLen;

            const targetPort = firstChunk.readUInt16BE(cursor);
            cursor += 2;

            const atype = firstChunk[cursor];
            cursor += 1;

            let targetHost = '';
            if (atype === 1) {
                targetHost = firstChunk.slice(cursor, cursor + 4).join('.');
                cursor += 4;
            } else if (atype === 3) {
                const hostLen = firstChunk[cursor];
                cursor += 1;
                targetHost = firstChunk.slice(cursor, cursor + hostLen).toString();
                cursor += hostLen;
            } else if (atype === 2) {
                targetHost = firstChunk.slice(cursor, cursor + 16).toString('hex').match(/.{1,4}/g).join(':');
                cursor += 16;
            } else {
                return ws.close();
            }

            const inboundData = firstChunk.slice(cursor);
            const remoteSocket = net.connect({ host: targetHost, port: targetPort }, () => {
                if (inboundData.length > 0) remoteSocket.write(inboundData);
                console.log(`🎯 [SUCCESS] Outbound connected: ${targetHost}:${targetPort}`);
            });

            ws.on('message', (msg) => { if (remoteSocket.writable) remoteSocket.write(msg); });
            remoteSocket.on('data', (data) => { if (ws.readyState === 1) ws.send(data); });

            remoteSocket.on('error', () => ws.close());
            remoteSocket.on('close', () => ws.close());
            ws.on('close', () => remoteSocket.end());
            ws.on('error', () => remoteSocket.end());

        } catch (err) {
            ws.close();
        }
    });
});

server.listen(port);
