const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'moducare_secure_jwt_secret_2026';
const JWT_EXPIRY = '8h';

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
