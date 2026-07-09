/**
 * ModuCare MS — Inventory Module
 * Features: Items, Purchase Orders, Stock Adjustments, Stock Transfers, Suppliers
 */
import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { hasRole, canAccessCapability } from '../../../js/auth.js';

let _cssLoaded = false;
function injectCSS() {
  if (_cssLoaded) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = '/src/features/inventory/styles.css';
  document.head.appendChild(l);
  _cssLoaded = true;
}

let currentTab = 'items';

export async function init(mount, State) {
  injectCSS();
  bindTabs(mount);
  bindFilters(mount);
  bindModals(mount);

  await loadItems(mount);
  return { destroy() {} };
}

// ── Tab & filter wiring ──────────────────────────────────────
function bindTabs(mount) {
  mount.querySelectorAll('.inv-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(mount, btn.dataset.tab));
  });
}

function switchTab(mount, tab) {
  currentTab = tab;
  mount.querySelectorAll('.inv-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  mount.querySelectorAll('.inv-panel').forEach(p => {
    p.style.display = (p.dataset.panel === tab) ? '' : 'none';
  });

  if (tab === 'items') loadItems(mount);
  else if (tab === 'pos') loadPOs(mount);
  else if (tab === 'adjustments') loadAdjustments(mount);
  else if (tab === 'transfers') loadTransfers(mount);
  else if (tab === 'suppliers') loadSuppliers(mount);
}

function bindFilters(mount) {
  mount.querySelector('#inv-search')?.addEventListener('input', () => loadItems(mount));
  mount.querySelector('#inv-category')?.addEventListener('change', () => loadItems(mount));
  mount.querySelector('#inv-stock-status')?.addEventListener('change', () => loadItems(mount));

  mount.querySelector('#inv-new-item-btn')?.addEventListener('click', () => openItemModal(mount));
  mount.querySelector('#inv-new-supplier-btn')?.addEventListener('click', () => openSupplierModal(mount));
  mount.querySelector('#inv-new-po-btn')?.addEventListener('click', () => openPOModal(mount));
}

function refreshCurrentTab(mount) {
  if (currentTab === 'items') loadItems(mount);
  else if (currentTab === 'pos') loadPOs(mount);
  else if (currentTab === 'adjustments') loadAdjustments(mount);
  else if (currentTab === 'transfers') loadTransfers(mount);
  else if (currentTab === 'suppliers') loadSuppliers(mount);
}

// ── Items ────────────────────────────────────────────────────
async function loadItems(mount) {
  const wrap = mount.querySelector('#inv-items-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<tr><td colspan="7" class="mc-muted">Loading…</td></tr>';

  const search = (mount.querySelector('#inv-search')?.value || '').toLowerCase();
  const category = mount.querySelector('#inv-category')?.value || '';
  const status = mount.querySelector('#inv-stock-status')?.value || '';

  try {
    const data = await apiFetch('/inventory');
    let items = data.inventory || data.items || [];
    items = items.filter(i => {
      if (search && !String(i.name || '').toLowerCase().includes(search)) return false;
      if (category && i.category !== category) return false;
      if (status === 'out' && !(i.current_stock <= 0)) return false;
      if (status === 'low' && !(i.current_stock > 0 && i.current_stock <= i.reorder_level)) return false;
      if (status === 'in' && !(i.current_stock > i.reorder_level)) return false;
      return true;
    });

    if (items.length === 0) {
      wrap.innerHTML = '<tr><td colspan="7" class="mc-muted">No items found.</td></tr>';
      return;
    }

    wrap.innerHTML = items.map(i => `
      <tr data-id="${escapeHTML(i.id)}">
        <td class="font-weight-500">${escapeHTML(i.name)}</td>
        <td><span class="badge badge-neutral">${escapeHTML(i.category || '—')}</span></td>
        <td>${i.current_stock ?? '—'}</td>
        <td>${i.reorder_level ?? '—'}</td>
        <td>${renderStockStatus(i)}</td>
        <td>${escapeHTML(i.supplier_name || '—')}</td>
        <td class="text-right">
          <button class="mc-btn mc-btn--sm" data-action="edit" data-id="${escapeHTML(i.id)}">Edit</button>
          <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${escapeHTML(i.id)}">Delete</button>
          <button class="mc-btn mc-btn--sm" data-action="adjust" data-id="${escapeHTML(i.id)}">Adjust</button>
          <button class="mc-btn mc-btn--sm" data-action="transfer" data-id="${escapeHTML(i.id)}">Transfer</button>
        </td>
      </tr>
    `).join('');

    wrap.querySelectorAll('[data-action="edit"]').forEach(b => b.addEventListener('click', () => openItemModal(mount, b.dataset.id)));
    wrap.querySelectorAll('[data-action="delete"]').forEach(b => b.addEventListener('click', () => deleteItem(mount, b.dataset.id)));
    wrap.querySelectorAll('[data-action="adjust"]').forEach(b => b.addEventListener('click', () => openAdjustModal(mount, b.dataset.id)));
    wrap.querySelectorAll('[data-action="transfer"]').forEach(b => b.addEventListener('click', () => openTransferModal(mount, b.dataset.id)));
  } catch (e) {
    wrap.innerHTML = '<tr><td colspan="7" class="mc-muted">Failed to load items.</td></tr>';
  }
}

function renderStockStatus(i) {
  const stock = i.current_stock;
  const reorder = i.reorder_level;
  if (stock === null || stock === undefined || reorder === null || reorder === undefined) return '<span class="badge badge-neutral">—</span>';
  if (stock <= 0) return '<span class="badge badge-danger">Out of Stock</span>';
  if (stock <= reorder) return '<span class="badge badge-warning">Low Stock</span>';
  return '<span class="badge badge-success">In Stock</span>';
}

// ── Purchase Orders ──────────────────────────────────────────
async function loadPOs(mount) {
  const wrap = mount.querySelector('#inv-pos-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<tr><td colspan="9" class="mc-muted">Loading…</td></tr>';

  try {
    const data = await apiFetch('/purchase-orders');
    const pos = data.purchase_orders || data.pos || data.data || [];
    if (pos.length === 0) {
      wrap.innerHTML = '<tr><td colspan="9" class="mc-muted">No purchase orders.</td></tr>';
      return;
    }

    wrap.innerHTML = pos.map(po => `
      <tr data-id="${escapeHTML(po.id)}">
        <td class="font-weight-500">${escapeHTML(po.po_number || po.number || po.id)}</td>
        <td>${escapeHTML(po.supplier_name || po.supplier || '—')}</td>
        <td>${statusBadge(po.status)}</td>
        <td>${po.total_items ?? po.items_count ?? '—'}</td>
        <td>${po.total_amount != null ? escapeHTML(String(po.total_amount)) : '—'}</td>
        <td>${escapeHTML(formatDate(po.created_at || po.date || '—'))}</td>
        <td class="text-secondary text-sm">${escapeHTML(po.created_by || '—')}</td>
        <td class="text-secondary text-sm">${escapeHTML(po.approved_by || '—')}</td>
        <td class="text-right">
          <button class="mc-btn mc-btn--sm" data-action="view" data-id="${escapeHTML(po.id)}">View</button>
          ${(po.status || '').toLowerCase() === 'draft' && canAccessCapability('inventory:approve') ? `<button class="mc-btn mc-btn--sm btn-primary" data-action="approve" data-id="${escapeHTML(po.id)}">Approve</button>` : ''}
          <button class="mc-btn mc-btn--sm" data-action="additem" data-id="${escapeHTML(po.id)}">Add Item</button>
        </td>
      </tr>
    `).join('');

    wrap.querySelectorAll('[data-action="view"]').forEach(b => b.addEventListener('click', () => showToast('PO details coming soon.', 'info')));
    wrap.querySelectorAll('[data-action="approve"]').forEach(b => b.addEventListener('click', () => approvePO(mount, b.dataset.id)));
    wrap.querySelectorAll('[data-action="additem"]').forEach(b => b.addEventListener('click', () => openPOItemModal(mount, b.dataset.id)));
  } catch (e) {
    wrap.innerHTML = '<tr><td colspan="9" class="mc-muted">Failed to load purchase orders.</td></tr>';
  }
}

async function approvePO(mount, id) {
  try {
    await apiFetch(`/purchase-orders/${id}/approve`, { method: 'POST' });
    showToast('Purchase order approved.', 'success');
    loadPOs(mount);
  } catch (e) {
    showToast(e.message || 'Failed to approve PO.', 'error');
  }
}

// ── Stock Adjustments ────────────────────────────────────────
async function loadAdjustments(mount) {
  const wrap = mount.querySelector('#inv-adjustments-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<tr><td colspan="6" class="mc-muted">Loading…</td></tr>';

  try {
    const data = await apiFetch('/stock-adjustments');
    const adjs = data.adjustments || data.data || [];
    if (adjs.length === 0) {
      wrap.innerHTML = '<tr><td colspan="6" class="mc-muted">No adjustments.</td></tr>';
      return;
    }

    wrap.innerHTML = adjs.map(a => `
      <tr data-id="${escapeHTML(a.id)}">
        <td>${escapeHTML(formatDate(a.date || a.created_at || '—'))}</td>
        <td>${escapeHTML(a.item_name || a.item || '—')}</td>
        <td>${escapeHTML(capitalize(a.type || '—'))}</td>
        <td>${a.change != null ? escapeHTML(String(a.change)) : '—'}</td>
        <td>${escapeHTML(a.reason || '—')}</td>
        <td>${escapeHTML(a.performed_by || a.performedBy || '—')}</td>
      </tr>
    `).join('');
  } catch (e) {
    wrap.innerHTML = '<tr><td colspan="6" class="mc-muted">Failed to load adjustments.</td></tr>';
  }
}

// ── Stock Transfers ──────────────────────────────────────────
async function loadTransfers(mount) {
  const wrap = mount.querySelector('#inv-transfers-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<tr><td colspan="8" class="mc-muted">Loading…</td></tr>';

  try {
    const data = await apiFetch('/stock-transfers');
    const trs = data.transfers || data.data || [];
    if (trs.length === 0) {
      wrap.innerHTML = '<tr><td colspan="8" class="mc-muted">No transfers.</td></tr>';
      return;
    }

    wrap.innerHTML = trs.map(t => `
      <tr data-id="${escapeHTML(t.id)}">
        <td>${escapeHTML(formatDate(t.date || t.created_at || '—'))}</td>
        <td>${escapeHTML(t.item_name || t.item || '—')}</td>
        <td>${escapeHTML(t.from_location || t.from || '—')}</td>
        <td>${escapeHTML(t.to_location || t.to || '—')}</td>
        <td>${t.qty != null ? escapeHTML(String(t.qty)) : '—'}</td>
        <td>${statusBadge(t.status)}</td>
        <td class="text-secondary text-sm">${escapeHTML(t.performed_by || t.performedBy || '—')}</td>
        <td class="text-right">
          ${(t.status || '').toLowerCase() === 'pending' && canAccessCapability('inventory:approve') ? `<button class="mc-btn mc-btn--sm btn-primary" data-action="approve" data-id="${escapeHTML(t.id)}">Approve</button>` : ''}
        </td>
      </tr>
    `).join('');

    wrap.querySelectorAll('[data-action="approve"]').forEach(b => b.addEventListener('click', () => approveTransfer(mount, b.dataset.id)));
  } catch (e) {
    wrap.innerHTML = '<tr><td colspan="8" class="mc-muted">Failed to load transfers.</td></tr>';
  }
}

async function approveTransfer(mount, id) {
  try {
    await apiFetch(`/stock-transfers/${id}/approve`, { method: 'POST' });
    showToast('Transfer approved.', 'success');
    loadTransfers(mount);
  } catch (e) {
    showToast(e.message || 'Failed to approve transfer.', 'error');
  }
}

// ── Suppliers ────────────────────────────────────────────────
async function loadSuppliers(mount) {
  const wrap = mount.querySelector('#inv-suppliers-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<tr><td colspan="7" class="mc-muted">Loading…</td></tr>';

  try {
    const data = await apiFetch('/suppliers');
    const suppliers = data.suppliers || data.data || [];
    if (suppliers.length === 0) {
      wrap.innerHTML = '<tr><td colspan="7" class="mc-muted">No suppliers.</td></tr>';
      return;
    }

    wrap.innerHTML = suppliers.map(s => `
      <tr data-id="${escapeHTML(s.id)}">
        <td class="font-weight-500">${escapeHTML(s.name || '—')}</td>
        <td>${escapeHTML(s.contact || '—')}</td>
        <td>${escapeHTML(s.email || '—')}</td>
        <td>${escapeHTML(s.phone || '—')}</td>
        <td><span class="badge badge-neutral">${escapeHTML(s.category || '—')}</span></td>
        <td>${statusBadge(s.status)}</td>
        <td class="text-right">
          <button class="mc-btn mc-btn--sm" data-action="edit" data-id="${escapeHTML(s.id)}">Edit</button>
          <button class="mc-btn mc-btn--sm btn-danger" data-action="delete" data-id="${escapeHTML(s.id)}">Delete</button>
        </td>
      </tr>
    `).join('');

    wrap.querySelectorAll('[data-action="edit"]').forEach(b => b.addEventListener('click', () => openSupplierModal(mount, b.dataset.id)));
    wrap.querySelectorAll('[data-action="delete"]').forEach(b => b.addEventListener('click', () => deleteSupplier(mount, b.dataset.id)));
  } catch (e) {
    wrap.innerHTML = '<tr><td colspan="7" class="mc-muted">Failed to load suppliers.</td></tr>';
  }
}

// ── Modals ───────────────────────────────────────────────────
function bindModals(mount) {
  mount.querySelectorAll('.inv-modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(mount, btn.dataset.modal));
  });
  mount.querySelectorAll('.inv-modal').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(mount, m.id); });
  });

  mount.querySelector('#inv-item-form')?.addEventListener('submit', (e) => submitItem(mount, e));
  mount.querySelector('#inv-supplier-form')?.addEventListener('submit', (e) => submitSupplier(mount, e));
  mount.querySelector('#inv-po-form')?.addEventListener('submit', (e) => submitPO(mount, e));
  mount.querySelector('#inv-po-item-form')?.addEventListener('submit', (e) => submitPOItem(mount, e));
  mount.querySelector('#inv-adjust-form')?.addEventListener('submit', (e) => submitAdjustment(mount, e));
  mount.querySelector('#inv-transfer-form')?.addEventListener('submit', (e) => submitTransfer(mount, e));
}

function openModal(mount, id) {
  const m = mount.querySelector('#' + id);
  if (m) m.style.display = 'flex';
}

function closeModal(mount, id) {
  const m = mount.querySelector('#' + id);
  if (m) m.style.display = 'none';
}

async function openItemModal(mount, id) {
  const modal = mount.querySelector('#inv-item-modal');
  const title = mount.querySelector('#inv-item-modal-title');
  const form = mount.querySelector('#inv-item-form');
  form.reset();
  mount.querySelector('#inv-item-id').value = '';
  await populateSuppliers(mount);

  if (id) {
    title.textContent = 'Edit Item';
    try {
      const data = await apiFetch('/inventory');
      const item = (data.inventory || []).find(i => String(i.id) === String(id));
      if (item) {
        mount.querySelector('#inv-item-id').value = item.id;
        mount.querySelector('#inv-item-name').value = item.name || '';
        mount.querySelector('#inv-item-category').value = item.category || 'other';
        mount.querySelector('#inv-item-supplier').value = item.supplier_id || '';
        mount.querySelector('#inv-item-stock').value = item.current_stock ?? '';
        mount.querySelector('#inv-item-reorder').value = item.reorder_level ?? '';
        mount.querySelector('#inv-item-unit').value = item.unit || '';
      }
    } catch (e) { /* ignore */ }
  } else {
    title.textContent = 'Add Item';
  }
  openModal(mount, 'inv-item-modal');
}

async function submitItem(mount, e) {
  e.preventDefault();
  const id = mount.querySelector('#inv-item-id').value;
  const payload = {
    name: mount.querySelector('#inv-item-name').value,
    category: mount.querySelector('#inv-item-category').value,
    supplier_id: mount.querySelector('#inv-item-supplier').value || null,
    current_stock: parseInt(mount.querySelector('#inv-item-stock').value) || 0,
    reorder_level: parseInt(mount.querySelector('#inv-item-reorder').value) || 0,
    unit: mount.querySelector('#inv-item-unit').value,
  };
  try {
    if (id) {
      await apiFetch(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Item updated.', 'success');
    } else {
      await apiFetch('/inventory', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Item added.', 'success');
    }
    closeModal(mount, 'inv-item-modal');
    loadItems(mount);
  } catch (e) {
    showToast(e.message || 'Failed to save item.', 'error');
  }
}

async function deleteItem(mount, id) {
  if (!confirm('Delete this item?')) return;
  try {
    await apiFetch(`/inventory/${id}`, { method: 'DELETE' });
    showToast('Item deleted.', 'success');
    loadItems(mount);
  } catch (e) {
    showToast(e.message || 'Failed to delete item.', 'error');
  }
}

async function openSupplierModal(mount, id) {
  const form = mount.querySelector('#inv-supplier-form');
  const title = mount.querySelector('#inv-supplier-modal-title');
  form.reset();
  mount.querySelector('#inv-supplier-id').value = '';

  if (id) {
    title.textContent = 'Edit Supplier';
    try {
      const data = await apiFetch('/suppliers');
      const s = (data.suppliers || []).find(x => String(x.id) === String(id));
      if (s) {
        mount.querySelector('#inv-supplier-id').value = s.id;
        mount.querySelector('#inv-supplier-name').value = s.name || '';
        mount.querySelector('#inv-supplier-contact').value = s.contact || '';
        mount.querySelector('#inv-supplier-category').value = s.category || 'other';
        mount.querySelector('#inv-supplier-email').value = s.email || '';
        mount.querySelector('#inv-supplier-phone').value = s.phone || '';
        mount.querySelector('#inv-supplier-status').value = s.status || 'active';
      }
    } catch (e) { /* ignore */ }
  } else {
    title.textContent = 'Add Supplier';
  }
  openModal(mount, 'inv-supplier-modal');
}

async function submitSupplier(mount, e) {
  e.preventDefault();
  const id = mount.querySelector('#inv-supplier-id').value;
  const payload = {
    name: mount.querySelector('#inv-supplier-name').value,
    contact: mount.querySelector('#inv-supplier-contact').value,
    category: mount.querySelector('#inv-supplier-category').value,
    email: mount.querySelector('#inv-supplier-email').value,
    phone: mount.querySelector('#inv-supplier-phone').value,
    status: mount.querySelector('#inv-supplier-status').value,
  };
  try {
    if (id) {
      await apiFetch(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Supplier updated.', 'success');
    } else {
      await apiFetch('/suppliers', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Supplier added.', 'success');
    }
    closeModal(mount, 'inv-supplier-modal');
    loadSuppliers(mount);
  } catch (e) {
    showToast(e.message || 'Failed to save supplier.', 'error');
  }
}

async function deleteSupplier(mount, id) {
  if (!confirm('Delete this supplier?')) return;
  try {
    await apiFetch(`/suppliers/${id}`, { method: 'DELETE' });
    showToast('Supplier deleted.', 'success');
    loadSuppliers(mount);
  } catch (e) {
    showToast(e.message || 'Failed to delete supplier.', 'error');
  }
}

async function openPOModal(mount) {
  const form = mount.querySelector('#inv-po-form');
  form.reset();
  await populateSuppliers(mount, '#inv-po-supplier');
  openModal(mount, 'inv-po-modal');
}

async function submitPO(mount, e) {
  e.preventDefault();
  const payload = {
    supplier_id: mount.querySelector('#inv-po-supplier').value,
    notes: mount.querySelector('#inv-po-notes').value,
  };
  try {
    await apiFetch('/purchase-orders', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Purchase order created.', 'success');
    closeModal(mount, 'inv-po-modal');
    loadPOs(mount);
  } catch (e) {
    showToast(e.message || 'Failed to create PO.', 'error');
  }
}

async function openPOItemModal(mount, poId) {
  const form = mount.querySelector('#inv-po-item-form');
  form.reset();
  mount.querySelector('#inv-po-item-poid').value = poId;
  await populateItems(mount, '#inv-po-item-item');
  openModal(mount, 'inv-po-item-modal');
}

async function submitPOItem(mount, e) {
  e.preventDefault();
  const poId = mount.querySelector('#inv-po-item-poid').value;
  const payload = {
    item_id: mount.querySelector('#inv-po-item-item').value,
    quantity: parseInt(mount.querySelector('#inv-po-item-qty').value) || 0,
    unit_price: parseFloat(mount.querySelector('#inv-po-item-price').value) || 0,
  };
  try {
    await apiFetch(`/purchase-orders/${poId}/items`, { method: 'POST', body: JSON.stringify(payload) });
    showToast('Item added to PO.', 'success');
    closeModal(mount, 'inv-po-item-modal');
    loadPOs(mount);
  } catch (e) {
    showToast(e.message || 'Failed to add PO item.', 'error');
  }
}

async function openAdjustModal(mount, itemId) {
  const form = mount.querySelector('#inv-adjust-form');
  form.reset();
  await populateItems(mount, '#inv-adjust-item');
  if (itemId) mount.querySelector('#inv-adjust-item').value = itemId;
  openModal(mount, 'inv-adjust-modal');
}

async function submitAdjustment(mount, e) {
  e.preventDefault();
  const payload = {
    item_id: mount.querySelector('#inv-adjust-item').value,
    type: mount.querySelector('#inv-adjust-type').value,
    change: parseInt(mount.querySelector('#inv-adjust-qty').value) || 0,
    reason: mount.querySelector('#inv-adjust-reason').value,
  };
  try {
    await apiFetch('/stock-adjustments', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Stock adjustment applied.', 'success');
    closeModal(mount, 'inv-adjust-modal');
    loadItems(mount);
    loadAdjustments(mount);
  } catch (e) {
    showToast(e.message || 'Failed to apply adjustment.', 'error');
  }
}

async function openTransferModal(mount, itemId) {
  const form = mount.querySelector('#inv-transfer-form');
  form.reset();
  await populateItems(mount, '#inv-transfer-item');
  if (itemId) mount.querySelector('#inv-transfer-item').value = itemId;
  openModal(mount, 'inv-transfer-modal');
}

async function submitTransfer(mount, e) {
  e.preventDefault();
  const payload = {
    item_id: mount.querySelector('#inv-transfer-item').value,
    from_location: mount.querySelector('#inv-transfer-from').value,
    to_location: mount.querySelector('#inv-transfer-to').value,
    qty: parseInt(mount.querySelector('#inv-transfer-qty').value) || 0,
  };
  try {
    await apiFetch('/stock-transfers', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Stock transfer initiated.', 'success');
    closeModal(mount, 'inv-transfer-modal');
    loadTransfers(mount);
  } catch (e) {
    showToast(e.message || 'Failed to initiate transfer.', 'error');
  }
}

// ── Select population helpers ────────────────────────────────
async function populateSuppliers(mount, selector) {
  const sel = mount.querySelector(selector || '#inv-item-supplier');
  if (!sel) return;
  try {
    const data = await apiFetch('/suppliers');
    const suppliers = data.suppliers || [];
    sel.innerHTML = '<option value="">— None —</option>' +
      suppliers.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
  } catch (e) { /* ignore */ }
}

async function populateItems(mount, selector) {
  const sel = mount.querySelector(selector);
  if (!sel) return;
  try {
    const data = await apiFetch('/inventory');
    const items = data.inventory || [];
    sel.innerHTML = '<option value="">— Select —</option>' +
      items.map(i => `<option value="${escapeHTML(i.id)}">${escapeHTML(i.name)}</option>`).join('');
  } catch (e) { /* ignore */ }
}

// ── Helpers ──────────────────────────────────────────────────
function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'approved' || s === 'active' || s === 'completed') return '<span class="badge badge-success">Active</span>';
  if (s === 'draft' || s === 'pending' || s === 'open') return '<span class="badge badge-warning">Pending</span>';
  if (s === 'inactive' || s === 'cancelled' || s === 'rejected') return '<span class="badge badge-danger">Inactive</span>';
  return `<span class="badge badge-neutral">${escapeHTML(status || '—')}</span>`;
}

function capitalize(str) {
  str = str || '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
