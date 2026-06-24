/**
 * ModuCare MS — Shared Utilities
 * Reusable helpers available to all modules.
 */

// ── Toast Notifications ──────────────────────────────────────
/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {number} duration ms (default 4000)
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    info:    '💬',
    success: '✅',
    warning: '⚠️',
    error:   '❌',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span style="flex-shrink:0;font-size:15px">${icons[type] ?? '💬'}</span>
    <span style="flex:1;line-height:1.4">${message}</span>
    <button style="flex-shrink:0;opacity:0.5;font-size:16px;line-height:1;margin-left:4px"
            aria-label="Dismiss" onclick="this.closest('.toast').remove()">×</button>
  `;
  container.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(12px)';
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ── Date & Time ──────────────────────────────────────────────
/**
 * Format a date as "Jan 15, 2025"
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDate(date = new Date()) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

/**
 * Format a date+time as "Jan 15, 2025 · 2:30 PM"
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDateTime(date = new Date()) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

/**
 * Returns a relative time string: "2 hours ago", "just now", etc.
 * @param {Date|string|number} date
 * @returns {string}
 */
export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60)   return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)   return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)     return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)       return `${days}d ago`;
  return formatDate(date);
}

// ── String Helpers ───────────────────────────────────────────
/**
 * Returns initials from a full name string.
 * "Jane Doe" → "JD"
 */
export function getInitials(name = '') {
  return name.trim().split(/\s+/).map(p => p[0]?.toUpperCase()).join('').slice(0, 2);
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHTML(str = '') {
  return String(str).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Capitalize first letter.
 */
export function capitalize(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Truncate text with ellipsis.
 * @param {string} text
 * @param {number} max
 */
export function truncate(text, max = 60) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// ── Number Helpers ───────────────────────────────────────────
/**
 * Format a number as currency.
 * @param {number} amount
 * @param {string} currency
 */
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Convert decimal hours to 15-minute billing units.
 * @param {number} hours
 * @returns {number} units
 */
export function hoursToBillingUnits(hours) {
  return Math.ceil(hours * 4); // 1 unit = 0.25 hr
}

// ── DOM Helpers ──────────────────────────────────────────────
/**
 * Query selector shorthand.
 */
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/**
 * Create an element with class and optional innerHTML.
 */
export function el(tag, className, html = '') {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html) e.innerHTML = html;
  return e;
}

// ── API Helpers ──────────────────────────────────────────────
/**
 * Wrapper around fetch with JSON defaults and auth headers.
 * Replace base URL with your real API endpoint.
 */
export async function apiFetch(path, options = {}) {
  const session = JSON.parse(
    sessionStorage.getItem('moducare_session') ||
    localStorage.getItem('moducare_session') || 'null'
  );

  const res = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `API Error ${res.status}`);
  }

  return res.json();
}

// ── CSV Export ───────────────────────────────────────────────
/**
 * Trigger a CSV file download from a 2D array.
 * @param {Array<Array>} rows
 * @param {string} filename
 */
export function exportCSV(rows, filename = 'export.csv') {
  const csv = rows.map(r => r.map(v =>
    typeof v === 'string' && v.includes(',') ? `"${v}"` : v
  ).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
