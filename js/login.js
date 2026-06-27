/**
 * ModuCare MS — Login Page Controller
 * Handles: form validation, password toggle,
 *          auth flow, and redirect after login.
 */
import { loginRequest, setSession, authRedirect } from './auth.js';
import { showToast } from './utils.js';

// Redirect away if already logged in
authRedirect('login');

// ── DOM References ───────────────────────────────────────────
const form       = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const pwdInput   = document.getElementById('password');
const rememberCb = document.getElementById('remember');
const signInBtn  = document.getElementById('sign-in-btn');
const btnText    = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const emailErr   = document.getElementById('email-error');
const pwdErr     = document.getElementById('password-error');
const pwdToggle  = document.getElementById('pwd-toggle');

// ── Password Toggle ──────────────────────────────────────────
pwdToggle?.addEventListener('click', () => {
  const isText = pwdInput.type === 'text';
  pwdInput.type = isText ? 'password' : 'text';
  const icon = document.getElementById('eye-icon');
  if (icon) {
    icon.innerHTML = isText
      ? '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  }
});

// ── Validation ───────────────────────────────────────────────
function validateEmail(value) {
  if (!value) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
  return '';
}

function validatePassword(value) {
  if (!value) return 'Password is required.';
  if (value.length < 4) return 'Password must be at least 4 characters.';
  return '';
}

function showError(inputEl, errEl, message) {
  inputEl.classList.toggle('input--error', !!message);
  if (errEl) errEl.textContent = message;
}

// Real-time validation
emailInput?.addEventListener('blur', () => {
  showError(emailInput, emailErr, validateEmail(emailInput.value.trim()));
});
pwdInput?.addEventListener('blur', () => {
  showError(pwdInput, pwdErr, validatePassword(pwdInput.value));
});
emailInput?.addEventListener('input', () => {
  if (emailInput.classList.contains('input--error')) {
    showError(emailInput, emailErr, validateEmail(emailInput.value.trim()));
  }
});

// ── Loading State ────────────────────────────────────────────
function setLoading(loading) {
  signInBtn.disabled = loading;
  btnText.textContent = loading ? 'Signing in…' : 'Sign In';
  btnSpinner?.classList.toggle('hidden', !loading);
}

// ── Form Submit ──────────────────────────────────────────────
form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email    = emailInput.value.trim();
  const password = pwdInput.value;
  const remember = rememberCb?.checked ?? false;

  // Validate all fields
  const emailErrMsg = validateEmail(email);
  const pwdErrMsg   = validatePassword(password);
  showError(emailInput, emailErr, emailErrMsg);
  showError(pwdInput,   pwdErr,   pwdErrMsg);
  if (emailErrMsg || pwdErrMsg) return;

  setLoading(true);

  try { 
    const result = await loginRequest(email, password);

    if (result.success) {
      setSession(result.user, result.token, remember);
      const who = (result.user?.email || result.user?.name || 'there').split(' ')[0];
      showToast('Welcome back, ' + who + '!', 'success');
      setTimeout(() => { window.location.replace('/'); }, 600);
    } else {
      showError(emailInput, emailErr, ' ');
      showError(pwdInput, pwdErr, result.error ?? 'Login failed. Please try again.');
      setLoading(false);
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast('Connection error. Please try again.', 'error');
    setLoading(false);
  }
});

// ── Keyboard: Submit on Enter ────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement !== signInBtn) {
    form?.requestSubmit();
  }
});