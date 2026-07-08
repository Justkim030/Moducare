const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000;

function getClientId(req) {
  return req.ip || req.socket?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
}

function checkRateLimit(req) {
  const id = getClientId(req);
  const now = Date.now();
  const record = loginAttempts.get(id) || { count: 0, ts: now };
  if (now - record.ts > WINDOW_MS) {
    record.count = 0;
    record.ts = now;
  }
  record.count += 1;
  loginAttempts.set(id, record);
  if (record.count > MAX_LOGIN_ATTEMPTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - record.ts)) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

function resetRateLimit(req) {
  const id = getClientId(req);
  loginAttempts.delete(id);
}

function checkBodySize(req, res, maxBytes = 1024 * 1024) {
  let received = 0;
  let aborted = false;

  req.on('data', (chunk) => {
    if (aborted) return;
    received += chunk.length;
    if (received > maxBytes) {
      aborted = true;
      if (!res.headersSent) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Payload too large.' }));
      }
      req.destroy();
    }
  });
}

module.exports = { checkRateLimit, resetRateLimit, checkBodySize };
