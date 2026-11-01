const http = require('http');
const { WebSocketServer } = require('ws');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process'); 

const uuid = process.env.UUID || process.env.APP_KEY;
const wsPath = process.env.WSPATH || process.env.API_ROUTE || '/api/v1/sync';
const port = parseInt(process.env.PORT || '3000', 10); 

if (!uuid) {
    console.error('❌ [ERROR] UUID is totally required! Please set it in Pxxl Secrets.');
    process.exit(1);
}

const xrayInternalPort = 10086;

const bin = path.join(__dirname, 'web-worker');
if (!fs.existsSync(bin)) {
  try { 
    console.log("⏳ [INIT] Downloading latest Xray Core components...");
    execSync('node setup.js', { stdio: 'inherit', cwd: __dirname }); 
  } catch (e) { 
    console.error("❌ [INIT FAILED] Cannot download Xray Core!");
    process.exit(1); 
  }
}

const cfg = {
  log: { loglevel: 'warning' },
  inbounds: [{
    listen: '127.0.0.1', 
    port: xrayInternalPort,
    protocol: 'vless',
    settings: { clients: [{ id: uuid }], decryption: 'none' },
    streamSettings: { network: 'ws', wsSettings: { path: wsPath } }
  }],
  outbounds: [{ protocol: 'freedom', tag: 'direct', settings: { domainStrategy: 'UseIPv4' } }]
};

const cfgPath = path.join('/tmp', 'runtime-' + crypto.randomBytes(4).toString('hex') + '.json');
fs.writeFileSync(cfgPath, JSON.stringify(cfg));

const child = spawn(bin, ['run', '-c', cfgPath], { stdio: 'inherit', cwd: __dirname });


const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>系统维护中 / System Maintenance</title>
      <style>
        body { font-family: sans-serif; background: #f4f7f6; color: #555; text-align: center; padding: 150px 20px; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        h1 { color: #ff5e5b; font-size: 24px; margin-top: 0; }
        p { font-size: 16px; line-height: 1.6; }
        .loader { height: 4px; width: 100%; background: #eee; border-radius: 2px; margin: 20px 0; overflow: hidden; position: relative; }
        .loader::after { content: ''; display: block; width: 40%; height: 100%; background: #ff5e5b; position: absolute; animation: move 2s infinite linear; }
        @keyframes move { 0% { left: -40%; } 100% { left: 100%; } }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>⚙️ 核心系统底层升级维护中</h1>
        <p>为了提供更优质、更稳定的网络环境，我们的后端 Workspace 正在进行例行架构迁移与优化。预计完成时间需要数小时，请稍后再试。</p>
        <div class="loader"></div>
        <p style="font-size: 12px; color: #aaa;">Service status: Active Running (Node.js Workspace)</p>
      </div>
    </body>
    </html>
  `);
});


const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url === wsPath) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      const xraySocket = net.connect({ port: xrayInternalPort, host: '127.0.0.1' }, () => {
        ws.on('message', (msg) => { if (xraySocket.writable) xraySocket.write(msg); });
        xraySocket.on('data', (data) => { if (ws.readyState === 1) ws.send(data); });
      });
      xraySocket.on('error', () => ws.close());
      ws.on('close', () => xraySocket.end());
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 [SYSTEM READY] Original Xray Core with Maintenance WebPage fully operational on port ${port}!`);
});

child.on('exit', (c) => process.exit(c || 0));
process.on('SIGTERM', () => { child.kill('SIGTERM'); process.exit(0); });
