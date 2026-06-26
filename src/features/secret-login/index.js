// Secret-login: security-by-obscurity route for admin access.
// WARNING: Disabled in production. Use proper server authentication.
const SECRET_TOKEN = process.env.NODE_ENV !== 'production' ? 'let-me-in-admin-2026' : null;

export async function init(mount, State) {
  if (process.env.NODE_ENV === 'production' || !SECRET_TOKEN) {
    mount.innerHTML = '<p class="mc-error">This endpoint is disabled in production.</p>';
    return;
  }
  
  const form = mount.querySelector('#secret-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = form.secret.value.trim();
    const name = form.username.value.trim() || 'Administrator';
    if (key === SECRET_TOKEN) {
      State.setUser({ name, role: 'admin' });
      history.pushState({}, '', '/admin');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      const err = mount.querySelector('.mc-error') || document.createElement('div');
      err.className = 'mc-error';
      err.textContent = 'Invalid secret key';
      mount.appendChild(err);
      setTimeout(() => err.remove(), 2500);
    }
  });
}