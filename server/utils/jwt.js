const jwt = require('jsonwebtoken');

// JWT_SECRET is intentionally NOT committed (.env is gitignored for security).
// In production a missing secret must never be silently defaulted, so we hard-fail.
// In development we fall back to a known, shared secret so a fresh clone runs
// without an .env file. It is constant (not random) so dev sessions survive restarts.
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  JWT_SECRET = 'dev-only-insecure-secret-do-not-use-in-production';
  console.warn(
    '\x1b[33m[auth]\x1b[0m JWT_SECRET is not set — using an insecure development default.\n' +
    '        Copy .env.example to .env and set JWT_SECRET for any non-dev use.'
  );
}

const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = { signToken, verifyToken, JWT_SECRET, JWT_EXPIRY };
