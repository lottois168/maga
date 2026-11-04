const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const HttpProxy = require('http-proxy'); 

const xxid = process.env.XXID || process.env.XX_KEY;
const magaPath = process.env.PATHONE || process.env.API_ONE || '/abc/xx/sys';
const port = parseInt(process.env.PORT || '3000', 10); 

if (!xxid) {
    console.error('❌ [ERROR] XXID requirement failed!');
    process.exit(1);
}

const farmerPort = 9527;

const bin = path.join(__dirname, 'web-farmer');
if (!fs.existsSync(bin)) {
  try { execSync('node wake.js', { stdio: 'inherit', cwd: __dirname }); }
  catch (e) { process.exit(1); }
}

const confg = {
  log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
  inbounds: [{
    listen: '127.0.0.1', port: farmerPort,
    protocol: 'vless',
    settings: { clients: [{ id: xxid }], decryption: 'none' },
    streamSettings: { network: 'ws', wsSettings: { path: magaPath } },
    sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'] }
  }],
  outbounds: [
    { protocol: 'freedom', tag: 'direct', settings: { domainStrategy: 'UseIP' } },
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
  dns: { servers: ['https://1.1.1.1/dns-query', 'https://8.8.8.8/dns-query'], queryStrategy: 'UseIPv4' }
};

const confgPath = path.join('/tmp', 'runtime-' + crypto.randomBytes(4).toString('hex') + '.json');
fs.writeFileSync(confgPath, JSON.stringify(confg));
const child = spawn(bin, ['run', '-c', confgPath], { stdio: 'inherit', cwd: __dirname });


const proxy = HttpProxy.createProxyServer({
  target: `http://127.0.0.1:${farmerPort}`,
  ws: true 
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>System under maintenance / System Maintenance</title>
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
        <h1>⚙️ Core system undergoing underlying upgrades and maintenance</h1>
        <p>To provide a higher-quality and more stable network environment, our backend Workspace is currently undergoing routine architectural migration and optimization. This process is expected to take several hours; please try again later.</p>
        <div class="loader"></div>
        <p style="font-size: 12px; color: #aaa;">Service status: Active Running (Node.js Workspace)</p>
      </div>
    </body>
    </html>
  `);
});


server.on('upgrade', (req, socket, head) => {
  if (req.url === magaPath) {
    proxy.ws(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 [SYSTEM READY] Original Farmer System with Maintenance WebPage fully operational on port ${port}!`);
});

proxy.on('error', (err) => {
  if (err.message.includes('ECONNRESET') || err.message.includes('EPIPE')) return;
  console.log(`[PROXY ERROR] ${err.message}`);
});

child.on('exit', (c) => process.exit(c || 0));
process.on('SIGTERM', () => { child.kill('SIGTERM'); process.exit(0); });
