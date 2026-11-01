const http = require('http');
const WebSocket = require('ws');
const net = require('net');

const uuid = (process.env.UUID || '').replace(/-/g, '').toLowerCase();
const port = process.env.PORT || 3000;

if (!uuid) {
  console.error("【错误】未检测到环境变量中的 UUID，请在 Pxxl 的 Secrets 中配置！");
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('VLESS Node Normal Work');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('【连接】收到客户端握手请求...');
  
  ws.once('message', (firstChunk) => {
    try {
      // 1. 严格校验 VLESS 协议版本及 UUID
      if (firstChunk.length < 18) { ws.close(); return; }
      
      const clientUuid = firstChunk.slice(1, 17).toString('hex');
      if (clientUuid !== uuid) {
        console.log('【验证失败】客户端暗号错误，拒绝服务！');
        ws.close();
        return;
      }

      // 2. 动态解析附加信息长度 (处理部分客户端带来的垃圾数据或Mux帧头)
      const addonLen = firstChunk[17];
      let cursor = 18 + addonLen;

      // 3. 精准提取目标端口 (2字节)
      if (cursor + 2 > firstChunk.length) { ws.close(); return; }
      const targetPort = firstChunk.readUInt16BE(cursor);
      cursor += 2;

      // 4. 精准解析地址类型及目标 Host
      const atype = firstChunk[cursor];
      cursor += 1;

      let targetHost = '';
      if (atype === 1) { // IPv4
        if (cursor + 4 > firstChunk.length) { ws.close(); return; }
        targetHost = firstChunk.slice(cursor, cursor + 4).join('.');
        cursor += 4;
      } else if (atype === 3) { // 域名
        const hostLen = firstChunk[cursor];
        cursor += 1;
        if (cursor + hostLen > firstChunk.length) { ws.close(); return; }
        targetHost = firstChunk.slice(cursor, cursor + hostLen).toString();
        cursor += hostLen;
      } else if (atype === 2) { // IPv6
        if (cursor + 16 > firstChunk.length) { ws.close(); return; }
        targetHost = firstChunk.slice(cursor, cursor + 16).toString('hex').match(/.{1,4}/g).join(':');
        cursor += 16;
      } else {
        console.log('【解析失败】未知的地址类型！');
        ws.close();
        return;
      }

      // 5. 提取真正需要转发的剩余原始数据流
      const rawData = firstChunk.slice(cursor);

      console.log(`【验证通过】成功解析目标 -> ${targetHost}:${targetPort}`);

      // 6. 建立真正的物理出站连接
      const remoteSocket = net.connect({ host: targetHost, port: targetPort }, () => {
        // 先发送握手时剩余的原始数据
        if (rawData.length > 0) remoteSocket.write(rawData);
        
        // 完美的双向数据管道 (Pipe)
        ws.on('message', (msg) => { remoteSocket.write(msg); });
        remoteSocket.on('data', (data) => { ws.send(data); });
      });

      // 健壮的错误捕获保护
      remoteSocket.on('error', (err) => {
        console.log(`【出站失败】无法连接目标网站，原因: ${err.message}`);
        ws.close();
      });

      remoteSocket.on('close', () => ws.close());
      ws.on('close', () => remoteSocket.end());
      ws.on('error', () => remoteSocket.end());

    } catch (e) {
      console.log(`【严重错误】协议解包崩溃: ${e.message}`);
      ws.close();
    }
  });
});

server.listen(port, () => {
  console.log(`【系统上线】服务器已在端口 ${port} 启动，正式版 Xray-VLESS 转发引擎加载成功！`);
});
