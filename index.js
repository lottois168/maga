const http = require('http');
const WebSocket = require('ws');
const net = require('net');
const uuid = process.env.UUID || '';
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Welcome');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('有新的客户端尝试连接...');
  
  ws.once('message', (firstChunk) => {
    if (firstChunk.length < 18) { ws.close(); return; }
    
    // 1. 验证暗号 (UUID)
    const clientUuid = firstChunk.slice(1, 17).toString('hex');
    const targetUuid = uuid.replace(/-/g, '').toLowerCase();

    if (clientUuid !== targetUuid) {
      console.log('暗号错误，拒绝连接！');
      ws.close();
      return;
    }

    console.log('暗号验证通过，开始转发流量！');
    
    // 2. 解析客户端真正想访问的目标网站和端口 (比如 Google.com:443)
    let offset = 17;
    const portBuf = firstChunk.slice(offset, offset + 2);
    const targetPort = portBuf.readUInt16BE(0);
    offset += 2;
    
    const atype = firstChunk[offset];
    offset += 1;
    
    let targetHost = '';
    if (atype === 1) { // IPv4 地址
      targetHost = firstChunk.slice(offset, offset + 4).join('.');
    } else if (atype === 3) { // 域名字符串
      const len = firstChunk[offset];
      targetHost = firstChunk.slice(offset + 1, offset + 1 + len).toString();
    } else {
      ws.close();
      return;
    }

    // 3. 真正去连接海外的网站
    const remoteSocket = net.connect({ host: targetHost, port: targetPort }, () => {
      console.log(`成功连接到目标网站: ${targetHost}:${targetPort}`);
      
      // 4. 双向倒腾数据（真正开始干活的物理转发）
      ws.on('message', (msg) => { remoteSocket.write(msg); });
      remoteSocket.on('data', (data) => { ws.send(data); });
    });

    // 错误处理与断开连接保护
    remoteSocket.on('error', () => ws.close());
    remoteSocket.on('close', () => ws.close());
    ws.on('close', () => remoteSocket.end());
    ws.on('error', () => remoteSocket.end());
  });
});

server.listen(port, () => {
  console.log(`服务器已在端口 ${port} 启动，核心转发引擎加载完毕！`);
});
