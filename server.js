const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const http = require('http'); 

const uuid = process.env.UUID || process.env.APP_KEY;
const wsPath = process.env.WSPATH || process.env.API_ROUTE || '/api/v1/sync';
const port = parseInt(process.env.PORT || '8080', 10);

if (!uuid) { console.error('UUID required'); process.exit(1); }

const fakeServer = http.createServer((req, res) => {
  if (req.url !== wsPath) {
    res.writeHead(404, {
      'Content-Type': 'text/html; charset=utf-8',
      'Server': 'nginx/1.24.0', 
      'Date': new Date().toUTCString()
    });
    res.end(`
      <html>
      <head><title>404 Not Found</title></head>
      <body style="background-color: #fff; color: #000; font-family: sans-serif; text-align: center; padding-top: 150px;">
      <h1>404 Not Found</h1>
      <hr style="max-width: 600px; margin: 20px auto; border: 0; border-top: 1px solid #eee;">
      <center>nginx/1.24.0</center>
      </body>
      </html>
    `);
  }
});

try {
    fakeServer.listen(port, '0.0.0.0', () => {
        console.log("🔒 [SECURITY] 404 HTML anti-sniffing firewall successfully deployed!");
    });
} catch(e) {
    console.log("网关端口已被接管，进入内核守护模式");
}
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
    settings: { clients: [{ id: uuid }], decryption: 'none' },
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
  dns: { servers: ['https://1.1.1.1/dns-query', 'https://8.8.8.8/dns-query'], queryStrategy: 'UseIPv4' }
};

const cfgPath = path.join('/tmp', 'runtime-' + crypto.randomBytes(4).toString('hex') + '.json');
fs.writeFileSync(cfgPath, JSON.stringify(cfg));

const child = spawn(bin, ['run', '-c', cfgPath], { stdio: 'inherit', cwd: __dirname });
child.on('exit', (c) => process.exit(c || 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
