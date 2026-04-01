/**
 * Pikes Family Dashboard — Local Brightness Service
 *
 * Runs on the Surface tablet to allow the web app to control screen brightness
 * via Windows WMI. Start with: node server.js
 *
 * Endpoints:
 *   GET  /status              → { ok: true, level: <current brightness> }
 *   GET  /brightness          → { level: <current brightness> }
 *   POST /brightness { level: 0-100 } → { ok: true, level: <set value> }
 */

const http = require('http');
const { execSync } = require('child_process');

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3737;

function getCurrentBrightness() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightness).CurrentBrightness"',
      { timeout: 5000 }
    ).toString().trim();
    const level = parseInt(out);
    return isNaN(level) ? null : level;
  } catch {
    return null;
  }
}

function setScreenBrightness(level) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  execSync(
    `powershell -NoProfile -Command "(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${clamped})"`,
    { timeout: 5000 }
  );
  return clamped;
}

function jsonResponse(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(data);
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.url === '/status' && req.method === 'GET') {
    const level = getCurrentBrightness();
    return jsonResponse(res, 200, { ok: true, level });
  }

  if (req.url === '/brightness' && req.method === 'GET') {
    const level = getCurrentBrightness();
    return jsonResponse(res, 200, { level });
  }

  if (req.url === '/brightness' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { level } = JSON.parse(body);
        if (typeof level !== 'number') {
          return jsonResponse(res, 400, { error: 'level must be a number 0-100' });
        }
        const set = setScreenBrightness(level);
        return jsonResponse(res, 200, { ok: true, level: set });
      } catch (err) {
        return jsonResponse(res, 500, { error: String(err) });
      }
    });
    return;
  }

  jsonResponse(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[PikesBrightness] Listening on http://127.0.0.1:${PORT}`);
});
