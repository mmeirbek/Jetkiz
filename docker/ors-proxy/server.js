const http = require('http');
const https = require('https');
const url = require('url');

const PORT = Number(process.env.PORT || 8090);
const ORS_BASE = process.env.ORS_BASE_URL || 'https://api.openrouteservice.org';
const ORS_API_KEY = process.env.OPENROUTESERVICE_API_KEY || '';

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const path = req.url;

    const target = url.parse(ORS_BASE);
    const upstream = https.request(
      {
        hostname: target.hostname,
        port: 443,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
          Authorization: ORS_API_KEY,
          Accept: '*/*',
        },
      },
      (upstreamRes) => {
        const out = [];
        upstreamRes.on('data', (c) => out.push(c));
        upstreamRes.on('end', () => {
          res.writeHead(upstreamRes.statusCode, {
            'Content-Type': 'application/json',
          });
          res.end(Buffer.concat(out));
        });
      }
    );

    upstream.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 2, error: 'ORS proxy upstream error: ' + err.message }));
    });

    upstream.write(body);
    upstream.end();
  });
});

server.listen(PORT, () => {
  console.log('ors-proxy listening on port ' + PORT);
});