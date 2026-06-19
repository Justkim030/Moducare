/**
 * ModuCare MS — Scheduling & Calendar Module
 * Asynchronously loads an external template.html and attaches styles.css sheets dynamically.
 */
import { showToast } from '../../../js/utils.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; 
  l.href = 'features/scheduling-calendar/styles.css';
  document.head.appendChild(l); 
  _cssLoaded = true;
}

export function render(container) {
  injectCSS();
  
  // Asynchronously fetch the HTML template blueprint
  fetch('features/scheduling-calendar/template.html')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to retrieve the scheduling layout template file.');
      }
      return response.text();
    })
    .then(htmlContent => {
      container.innerHTML = htmlContent;
      bindEvents(container);
    })
    .catch(error => {
      console.error(error);
      container.innerHTML = `<div class="alert alert--danger" style="margin: var(--sp-4);">
        <strong>Loading Error:</strong> Unable to process the module structural view context.
      </div>`;
    });
}

function bindEvents(container) {
  // Handle action trigger overlays
  container.querySelector('#sched-new-evt-btn')?.addEventListener('click', () => {
    showToast('Scheduling context entry panel initialized.', 'info');
  });

  // Handle calendar view layout selectors
  container.querySelectorAll('.sched-tab-btn').forEach(btn => {
    btn.onclick = (e) => {
      container.querySelectorAll('.sched-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      showToast(`Switched calendar matrix to layout: ${e.target.dataset.view}`, 'success');
    };
  });
}