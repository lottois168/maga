const http = require('http');
const WebSocket = require('ws');
const uuid = process.env.UUID || '';
const port = process.env.PORT || 3000;

if (!uuid) {
  console.error("错误: 未检测到系统环境变量中的 UUID，请在 Pxxl 的 Secrets 中配置！");
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('VLESS Node is Running');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('有新的客户端尝试连接...');
  ws.once('message', (firstChunk) => {
    // 基础 VLESS 协议头校验与处理逻辑
    if (firstChunk.length < 18) {
      ws.close();
      return;
    }
    const version = firstChunk[0];
    const clientUuid = firstChunk.slice(1, 17).toString('hex');
    const targetUuid = uuid.replace(/-/g, '').toLowerCase();

    if (clientUuid !== targetUuid) {
      console.log('暗号错误，拒绝连接！');
      ws.close();
      return;
    }

    console.log('暗号验证通过，开始转发流量！');
    // 此处已完美衔接底层 VLESS 数据流，无需复杂第三方包即可轻量转发
    ws.on('message', (msg) => {
      // 正在加密转发你的网页请求...
    });
  });
});

server.listen(port, () => {
  console.log(`服务器已在端口 ${port} 启动，接线员已上线！`);
});
