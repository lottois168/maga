const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const http = require('http'); 

const uuid = process.env.UUID || process.env.APP_KEY;
const wsPath = process.env.WSPATH || process.env.API_ROUTE || '/api/v1/sync';
const port = parseInt(process.env.PORT || '8080', 10);

if (!uuid) { console.error('UUID required'); process.exit(1); }

const maintenanceServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>系统维护中 / System Maintenance</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7f6; color: #555; text-align: center; padding: 150px 20px; margin: 0; }
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
        <p style="font-size: 12px; color: #aaa;">Service status: Under Maintenance (Node.js Environment)</p>
      </div>
    </body>
    </html>
  `);
});

maintenanceServer.listen(8081, '127.0.0.1', () => {
    console.log("🔒 [SECURITY] 精美静态维护网页已在内网 8081 端口安全上架！");
});
// ======================================================================

const bin = path.join(__dirname, 'web-worker');
if (!fs.existsSync(bin)) {
  try { execSync('node setup.js', { stdio: 'inherit', cwd: __dirname }); }
  catch (e) { process.exit(1); }
}

const cfg = {
  log: { loglevel: 'warning' },
  inbounds: [{
    listen: '0.0.0.0', port,
    protocol: 'vless',
    settings: { 
      clients: [{ id: uuid }], 
      decryption: 'none',
      fallbacks: [
        {
          dest: "127.0.0.1:8081", 
          xver: 0
        }
      ]
    },
    streamSettings: { network: 'ws', wsSettings: { path: wsPath } },
    sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] }
  }],
  outbounds: [
    { protocol: 'freedom', tag: 'direct', settings: { domainStrategy: 'UseIPv4' } },
    { protocol: 'blackhole', tag: 'block' }
  ],
  routing: {
    domainStrategy: 'IPIfNonMatch',
    rules: [
      { type: 'field', outboundTag: 'block', protocol: ['bittorrent'] },
      { type: 'field', outboundTag: 'block', ip: ['geoip:private'] },
      { type: 'field', outboundTag: 'block', domain: ['geosite:private'] }
    ]
  },
  dns: { servers: ['https://1.1.1', 'https://8.8.8'], queryStrategy: 'UseIPv4' }
};

const cfgPath = path.join('/tmp', 'runtime-' + crypto.randomBytes(4).toString('hex') + '.json');
fs.writeFileSync(cfgPath, JSON.stringify(cfg));

const child = spawn(bin, ['run', '-c', cfgPath], { stdio: 'inherit', cwd: __dirname });
child.on('exit', (c) => process.exit(c || 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
