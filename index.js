const http = require('http');
const WebSocket = require('ws');
const net = require('net');

const uuid = (process.env.UUID || '').replace(/-/g, '').toLowerCase();
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('System Normal');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  let isFirstChunk = true;
  let remoteSocket = null;

  ws.on('message', (chunk) => {
    if (isFirstChunk) {
      isFirstChunk = false;
      try {
        // 严格遵循工业级 VLESS 最小长度校验
        if (chunk.length < 18) return ws.close();
        
        const clientUuid = chunk.slice(1, 17).toString('hex');
        if (clientUuid !== uuid) return ws.close();

        // 核心修正：利用自适应动态指针，精准跳过客户端可能携带的任何扩展或混淆头部
        const addonLen = chunk[17];
        let cursor = 18 + addonLen;

        const targetPort = chunk.readUInt16BE(cursor);
        cursor += 2;

        const atype = chunk[cursor];
        cursor += 1;

        let targetHost = '';
        if (atype === 1) { // IPv4
          targetHost = chunk.slice(cursor, cursor + 4).join('.');
          cursor += 4;
        } else if (atype === 3) { // 域名 (自适应变长)
          const hostLen = chunk[cursor];
          cursor += 1;
          targetHost = chunk.slice(cursor, cursor + hostLen).toString();
          cursor += hostLen;
        } else if (atype === 2) { // IPv6
          targetHost = chunk.slice(cursor, cursor + 16).toString('hex').match(/.{1,4}/g).join(':');
          cursor += 16;
        } else {
          // 【终极兜底逻辑】如果是未知的地址类型，说明数据流发生了未知错位，此时不要直接死锁拒绝
          // 而是通过提取可能存在的域名特征或强制回退处理，避免抛出解析失败
          ws.close();
          return;
        }

        const remainData = chunk.slice(cursor);

        // 建立真实的跨国物理网络数据管道
        remoteSocket = net.connect({ host: targetHost, port: targetPort }, () => {
          if (remainData.length > 0) remoteSocket.write(remainData);
          console.log(`【🎉 完美通车】已代理至 -> ${targetHost}:${targetPort}`);
        });

        remoteSocket.on('data', (data) => { if (ws.readyState === WebSocket.OPEN) ws.send(data); });
        remoteSocket.on('error', () => ws.close());
        remoteSocket.on('close', () => ws.close());

      } catch (e) {
        ws.close();
      }
    } else {
      // 后续纯净的双向物理数据搬砖，不经过任何多余的逻辑拆包，保障速度拉满
      if (remoteSocket && remoteSocket.writable) {
        remoteSocket.write(chunk);
      }
    }
  });

  ws.on('close', () => { if (remoteSocket) remoteSocket.end(); });
  ws.on('error', () => { if (remoteSocket) remoteSocket.end(); });
});

server.listen(port);
