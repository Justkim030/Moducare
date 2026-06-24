/**
 * ModuCare MS — Inventory Module
 * Features: Stock tracking, stock-out alerts, reorder management
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'src/features/inventory/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

export function render(container) {
  injectCSS();
  container.innerHTML = buildShell();
  bindEvents(container);
  refreshList(container);
}

export async function init(container, State) {
  injectCSS();
  render(container);
  return { destroy() {} };
}

function buildShell() {
  return `
  <div class="inv-layout">
    <div class="inv-header">
      <h1>📦 Inventory & Assets</h1>
      <button class="mc-btn btn-primary" id="new-inv-btn">+ Add Item</button>
    </div>
    <div class="inv-filters">
      <select id="inv-filter-low" class="input" style="width:auto;">
        <option value="">All Items</option>
        <option value="true">Low Stock</option>
      </select>
    </div>
    <div id="inv-list"></div>

    <div id="inv-modal" class="modal-overlay" style="display:none;">
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header">
          <h2>Add Inventory Item</h2>
          <button class="modal-close" id="close-inv-modal">&times;</button>
        </div>
        <form id="inv-form" class="inv-form">
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Item Name *</label>
              <input type="text" id="inv-name" class="input" required placeholder="e.g. TLD tablets">
            </div>
            <div class="input-group">
              <label class="input-label">Category</label>
              <select id="inv-category" class="input">
                <option value="medication">Medication</option>
                <option value="consumable">Consumable</option>
                <option value="equipment">Equipment</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label class="input-label">Current Stock</label>
              <input type="number" id="inv-stock" class="input" placeholder="0">
            </div>
            <div class="input-group">
              <label class="input-label">Reorder Level</label>
              <input type="number" id="inv-reorder" class="input" placeholder="10">
            </div>
          </div>
          <div class="input-group">
            <label class="input-label">Unit</label>
            <input type="text" id="inv-unit" class="input" placeholder="e.g. tablets, boxes">
          </div>
          <div class="form-actions">
            <button type="button" class="mc-btn-secondary" id="cancel-inv">Cancel</button>
            <button type="submit" class="mc-btn btn-primary">Add Item</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

async function refreshList(container) {
  const list = container.querySelector('#inv-list');
  if (!list) return;
  try {
    const data = await apiFetch('/inventory');
    const items = data.inventory || [];
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state"><h3>No inventory items</h3><p>Add items to track stock levels.</p></div>`;
      return;
    }
    list.innerHTML = `
      <div class="inv-table-wrap">
        <table class="mc-table inv-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Reorder</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td>${escapeHTML(i.name)}</td>
                <td><span class="badge badge-neutral">${escapeHTML(i.category)}</span></td>
                <td>${i.current_stock ?? '—'}</td>
                <td>${i.reorder_level ?? '—'}</td>
                <td>${renderStockStatus(i)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {
    list.innerHTML = `<div class="empty-state"><h3>Inventory endpoint unavailable</h3><p>Stock tracking will be available once the endpoint is connected.</p></div>`;
  }
}

function renderStockStatus(i) {
  const stock = i.current_stock;
  const reorder = i.reorder_level;
  if (stock === null || reorder === null) return '<span class="muted">—</span>';
  if (stock <= 0) return '<span class="badge badge-danger">Out of Stock</span>';
  if (stock <= reorder) return '<span class="badge badge-warning">Low Stock</span>';
  return '<span class="badge badge-success">In Stock</span>';
}

async function bindEvents(container) {
  const modal = container.querySelector('#inv-modal');
  const form = container.querySelector('#inv-form');

  container.querySelector('#new-inv-btn')?.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  container.querySelector('#close-inv-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });
  container.querySelector('#cancel-inv')?.addEventListener('click', () => { modal.style.display = 'none'; });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: container.querySelector('#inv-name')?.value,
      category: container.querySelector('#inv-category')?.value,
      current_stock: parseInt(container.querySelector('#inv-stock')?.value) || 0,
      reorder_level: parseInt(container.querySelector('#inv-reorder')?.value) || 10,
      unit: container.querySelector('#inv-unit')?.value,
    };
    try {
      await apiFetch('/inventory', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Item added', 'success');
      modal.style.display = 'none';
      form.reset();
      refreshList(container);
    } catch {
      showToast('Failed to add item', 'error');
    }
  });

  container.querySelector('#inv-filter-low')?.addEventListener('change', () => refreshList(container));
}
