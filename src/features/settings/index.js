/**
 * ModuCare MS — Settings Module
 */
import { showToast } from '../../../js/utils.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/settings/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

export async function init(container, State) {
  injectCSS();
  render(container);
  return { destroy() {} };
}

async function render(container) {
  try {
    const tmpl = await (await fetch('/src/features/settings/template.html')).text();
    container.innerHTML = tmpl;
  } catch {
    container.innerHTML = buildShell();
  }
}

function buildShell() {
  return `
  <div class="settings-layout">
    <h2>Settings</h2>
    <div class="settings-card">
      <p class="mc-muted">Application settings and preferences will be managed here.</p>
      <div class="settings-section">
        <h3>Notifications</h3>
        <label class="setting-toggle"><input type="checkbox" checked disabled> Email notifications <span class="muted">(default)</span></label>
        <label class="setting-toggle"><input type="checkbox" disabled> SMS reminders <span class="muted">(default)</span></label>
      </div>
      <div class="settings-section">
        <h3>Security</h3>
        <label class="setting-toggle"><input type="checkbox" checked disabled> Two-factor authentication <span class="muted">(default)</span></label>
      </div>
    </div>
  </div>`;
}
