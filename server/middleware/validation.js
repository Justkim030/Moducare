const KNOWN_PREFIXES = ['usr_', 'emp_', 'pat_', 'appt_', 'inc_', 'fin_', 'doc_', 'role_'];

function validateRequired(fields) {
  if (typeof fields === 'string') fields = [fields];
  const missing = [];
  for (const f of fields) {
    if (f == null || f === undefined || String(f).trim() === '') {
      missing.push(f);
    }
  }
  return missing;
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
}

function validatePhone(phone) {
  if (!phone || String(phone).trim() === '') return true;
  const p = String(phone).trim();
  const kenyanRe = /^(\+254|0)[17]\d{8}$/;
  const intlRe = /^\+[1-9]\d{6,17}$/;
  return kenyanRe.test(p) || intlRe.test(p);
}

function sanitizeString(str) {
  if (str == null || str === undefined) return '';
  let s = String(str);
  s = s.replace(/\0/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function validateUUID(id) {
  if (!id || typeof id !== 'string') return false;
  const s = id.trim();
  if (s.length <= 5) return false;
  return KNOWN_PREFIXES.some((pre) => s.startsWith(pre));
}

module.exports = {
  validateRequired,
  validateEmail,
  validatePhone,
  sanitizeString,
  validateUUID,
};

