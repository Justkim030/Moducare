import { MOCK_INCIDENTS, INCIDENT_SEVERITIES } from './data/incidents.js';

export async function init(mount, State) {
  console.log("Clinical Incident Reporting module mounting cleanly...");

  // Local feature state array
  let incidents = [...MOCK_INCIDENTS];

  // UI elements queries
  const tableBody = mount.querySelector('#incident-table-body');
  const btnNew = mount.querySelector('#btn-new-incident');
  const modalRoot = mount.querySelector('#incident-modal-root');
  const modalClose = mount.querySelector('#modal-close');

  // Render metrics cards data
  function updateMetrics() {
    if (mount.querySelector('#stat-total')) mount.querySelector('#stat-total').textContent = incidents.length;
    if (mount.querySelector('#stat-review')) mount.querySelector('#stat-review').textContent = incidents.filter(i => i.status === 'Under Review').length;
    if (mount.querySelector('#stat-critical')) mount.querySelector('#stat-critical').textContent = incidents.filter(i => i.severity === 'S1' || i.severity === 'S2').length;
    if (mount.querySelector('#stat-closed')) mount.querySelector('#stat-closed').textContent = incidents.filter(i => i.status === 'Closed').length;
  }

  // Draw current logs table matching standard dashboard components
  function renderTable() {
    if (!tableBody) return;
    tableBody.innerHTML = incidents.map(item => `
      <tr class="clickable-row" data-id="${item.id}" style="cursor: pointer;">
        <td><strong>${item.id}</strong></td>
        <td>${item.date} <span class="mc-muted">${item.time}</span></td>
        <td>${item.category}</td>
        <td><span class="badge" style="background-color: ${INCIDENT_SEVERITIES[item.severity]?.color || '#ccc'}; color: white;">${item.severity}</span></td>
        <td>${item.reporterName} <span class="mc-muted">(${item.reporterRole})</span></td>
        <td><span class="badge">${item.status}</span></td>
      </tr>
    `).join('');
  }

  // Setup Event Actions
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      alert("Form Modal Activated: This is where practitioners log active hospital data inputs natively!");
    });
  }

  // Initial Load Actions
  updateMetrics();
  renderTable();

  return {
    destroy: () => {
      console.log("Clinical Incident Reporting module cleanly destroyed.");
    }
  };
}
