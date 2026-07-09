import { showToast, formatDate, escapeHTML, apiFetch } from '../../../js/utils.js';
import { getSession } from '../../../js/auth.js';

export async function init(mount) {
  bindEvents(mount);
  loadTodayStatus(mount);
  loadHistory(mount);
  loadLeaveRequests(mount);
  loadAdminPanel(mount);
  return { destroy: function() { if (mount) mount.innerHTML = ''; } };
}

function bindEvents(mount) {
  var tabs = mount.querySelectorAll('.ta-tab');
  var i;
  for (i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function() {
      var allTabs = mount.querySelectorAll('.ta-tab');
      var allPanels = mount.querySelectorAll('.ta-panel');
      var j;
      for (j = 0; j < allTabs.length; j++) {
        allTabs[j].classList.remove('active');
      }
      for (j = 0; j < allPanels.length; j++) {
        allPanels[j].classList.remove('active');
      }
      tabs[i].classList.add('active');
      var panel = mount.querySelector('.ta-panel[data-panel="' + tabs[i].dataset.tab + '"]');
      if (panel) panel.classList.add('active');
    });
  }

  var clockInBtn = mount.querySelector('#clock-in-btn');
  if (clockInBtn) {
    clockInBtn.addEventListener('click', async function() {
      try {
        await apiFetch('/attendance/clock-in', { method: 'POST' });
        showToast('Clocked in successfully', 'success');
        loadTodayStatus(mount);
      } catch (err) {
        showToast(err.message || 'Clock in failed', 'error');
      }
    });
  }

  var clockOutBtn = mount.querySelector('#clock-out-btn');
  if (clockOutBtn) {
    clockOutBtn.addEventListener('click', async function() {
      try {
        await apiFetch('/attendance/clock-out', { method: 'POST' });
        showToast('Clocked out successfully', 'success');
        loadTodayStatus(mount);
      } catch (err) {
        showToast(err.message || 'Clock out failed', 'error');
      }
    });
  }

  var newLeaveBtn = mount.querySelector('#new-leave-btn');
  if (newLeaveBtn) {
    newLeaveBtn.addEventListener('click', function() {
      var modal = mount.querySelector('#leave-modal');
      if (modal) modal.style.display = 'flex';
    });
  }

  var closeLeaveModal = mount.querySelector('#close-leave-modal');
  if (closeLeaveModal) {
    closeLeaveModal.addEventListener('click', function() {
      var modal = mount.querySelector('#leave-modal');
      if (modal) modal.style.display = 'none';
    });
  }

  var cancelLeave = mount.querySelector('#cancel-leave');
  if (cancelLeave) {
    cancelLeave.addEventListener('click', function() {
      var modal = mount.querySelector('#leave-modal');
      if (modal) modal.style.display = 'none';
    });
  }

  var leaveForm = mount.querySelector('#leave-form');
  if (leaveForm) {
    leaveForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var leaveTypeEl = mount.querySelector('#leave-type');
      var leaveStartEl = mount.querySelector('#leave-start');
      var leaveEndEl = mount.querySelector('#leave-end');
      var leaveReasonEl = mount.querySelector('#leave-reason');
      var payload = {
        leave_type: leaveTypeEl ? leaveTypeEl.value : '',
        start_date: leaveStartEl ? leaveStartEl.value : '',
        end_date: leaveEndEl ? leaveEndEl.value : '',
        reason: leaveReasonEl ? leaveReasonEl.value.trim() : '',
      };
      var start = new Date(payload.start_date);
      var end = new Date(payload.end_date);
      payload.days_count = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

      try {
        await apiFetch('/leave', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Leave request submitted', 'success');
        var modal = mount.querySelector('#leave-modal');
        if (modal) modal.style.display = 'none';
        if (leaveForm) leaveForm.reset();
        loadLeaveRequests(mount);
      } catch (err) {
        showToast(err.message || 'Failed', 'error');
      }
    });
  }

  var monthFilter = mount.querySelector('#ta-month-filter');
  if (monthFilter) {
    monthFilter.addEventListener('change', function() {
      loadHistory(mount);
    });
  }

  var leaveTable = mount.querySelector('#ta-leave-table');
  if (leaveTable) {
    leaveTable.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var id = btn.dataset.id;
      var action = btn.dataset.action;
      if (action === 'approve') {
        apiFetch('/leave/' + id + '/approve', { method: 'POST' }).then(function() {
          showToast('Leave approved', 'success');
          loadLeaveRequests(mount);
        }).catch(function(err) {
          showToast(err.message, 'error');
        });
      } else if (action === 'reject') {
        var reason = prompt('Rejection reason:');
        if (reason === null) return;
        apiFetch('/leave/' + id + '/reject', { method: 'POST', body: JSON.stringify({ rejection_reason: reason }) }).then(function() {
          showToast('Leave rejected', 'success');
          loadLeaveRequests(mount);
        }).catch(function(err) {
          showToast(err.message, 'error');
        });
      }
    });
  }
}

async function loadTodayStatus(mount) {
  var session = getSession();
  if (!session) return;

  try {
    var data = await apiFetch('/attendance');
    var records = data.attendance || [];
    var today = new Date().toISOString().split('T')[0];
    var todayRecord = null;
    var r;
    for (r = 0; r < records.length; r++) {
      if (records[r].date === today) {
        todayRecord = records[r];
        break;
      }
    }

    var icon = mount.querySelector('#ta-status-icon');
    var text = mount.querySelector('#ta-status-text');
    var detail = mount.querySelector('#ta-status-detail');
    var clockInBtn = mount.querySelector('#clock-in-btn');
    var clockOutBtn = mount.querySelector('#clock-out-btn');

    if (!todayRecord) {
      if (icon) icon.textContent = '🕐';
      if (text) text.textContent = 'Not clocked in';
      if (detail) detail.textContent = 'Click Clock In to start your day';
      if (clockInBtn) { clockInBtn.disabled = false; clockInBtn.textContent = 'Clock In'; }
      if (clockOutBtn) clockOutBtn.disabled = true;
    } else if (todayRecord.clock_in && !todayRecord.clock_out) {
      if (icon) icon.textContent = '🟢';
      if (text) text.textContent = 'Clocked In';
      if (detail) detail.textContent = 'Since ' + formatDate(todayRecord.clock_in);
      if (clockInBtn) clockInBtn.disabled = true;
      if (clockOutBtn) { clockOutBtn.disabled = false; clockOutBtn.textContent = 'Clock Out'; }
    } else if (todayRecord.clock_in && todayRecord.clock_out) {
      var hours = todayRecord.total_hours || 0;
      if (icon) icon.textContent = '✅';
      if (text) text.textContent = 'Completed';
      if (detail) detail.textContent = hours.toFixed(1) + 'h today — ' + formatDate(todayRecord.clock_in) + ' to ' + formatDate(todayRecord.clock_out);
      if (clockInBtn) clockInBtn.disabled = true;
      if (clockOutBtn) clockOutBtn.disabled = true;
    }
  } catch (err) {
    // silently fail for today status
  }
}

async function loadHistory(mount) {
  var list = mount.querySelector('#ta-history-table');
  if (!list) return;
  var month = mount.querySelector('#ta-month-filter') ? mount.querySelector('#ta-month-filter').value : '';
  var url = '/attendance';
  if (month) url += '?month=' + month;

  try {
    var data = await apiFetch(url);
    var records = data.attendance || [];
    if (records.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>No attendance records</h3></div>';
      return;
    }

    var rows = [];
    var i;
    for (i = 0; i < records.length; i++) {
      var r = records[i];
      var statusClass = 'absent';
      if (r.status === 'present') statusClass = 'present';
      else if (r.status === 'leave') statusClass = 'leave';
      rows.push('<tr>' +
        '<td>' + escapeHTML(r.date) + '</td>' +
        '<td>' + (r.clock_in ? formatDate(r.clock_in) : '—') + '</td>' +
        '<td>' + (r.clock_out ? formatDate(r.clock_out) : '—') + '</td>' +
        '<td>' + (r.total_hours || 0).toFixed(1) + 'h</td>' +
        '<td><span class="ta-badge ta-badge--' + statusClass + '">' + escapeHTML(r.status) + '</span></td>' +
      '</tr>');
    }

    list.innerHTML = '<div class="ta-table-wrap"><table class="ta-table"><thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Status</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  } catch (err) {
    list.innerHTML = '<div class="empty-state"><h3>Failed to load history</h3></div>';
  }
}

async function loadLeaveRequests(mount) {
  var list = mount.querySelector('#ta-leave-table');
  if (!list) return;

  try {
    var data = await apiFetch('/leave');
    var leaves = data.leave_requests || [];
    if (leaves.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>No leave requests</h3></div>';
      return;
    }

    var rows = [];
    var i;
    for (i = 0; i < leaves.length; i++) {
      var l = leaves[i];
      var statusClass = 'pending';
      if (l.status === 'approved') statusClass = 'present';
      else if (l.status === 'rejected') statusClass = 'absent';
      var actions = '';
      if (l.status === 'pending') {
        actions = '<button class="mc-btn mc-btn--sm btn-primary" data-action="approve" data-id="' + l.id + '">Approve</button>' +
          '<button class="mc-btn mc-btn--sm btn-danger" data-action="reject" data-id="' + l.id + '">Reject</button>';
      } else {
        actions = '—';
      }
      rows.push('<tr>' +
        '<td>' + escapeHTML(l.user_name || '—') + '</td>' +
        '<td>' + escapeHTML(l.leave_type || '—') + '</td>' +
        '<td>' + escapeHTML(l.start_date || '') + ' to ' + escapeHTML(l.end_date || '') + '</td>' +
        '<td>' + (l.days_count || 0) + '</td>' +
        '<td>' + escapeHTML(l.reason || '—') + '</td>' +
        '<td><span class="ta-badge ta-badge--' + statusClass + '">' + escapeHTML(l.status) + '</span></td>' +
        '<td>' + actions + '</td>' +
      '</tr>');
    }

    list.innerHTML = '<div class="ta-table-wrap"><table class="ta-table"><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  } catch (err) {
    list.innerHTML = '<div class="empty-state"><h3>Failed to load leave requests</h3></div>';
  }
}

async function loadAdminPanel(mount) {
  var list = mount.querySelector('#ta-admin-table');
  if (!list) return;

  try {
    var data = await apiFetch('/attendance');
    var records = data.attendance || [];
    if (records.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>No attendance records</h3></div>';
      return;
    }

    var rows = [];
    var i;
    for (i = 0; i < records.length; i++) {
      var r = records[i];
      var statusClass = 'absent';
      if (r.status === 'present') statusClass = 'present';
      else if (r.status === 'leave') statusClass = 'leave';
      rows.push('<tr>' +
        '<td>' + escapeHTML(r.user_name || '—') + '</td>' +
        '<td>' + escapeHTML(r.date) + '</td>' +
        '<td>' + (r.clock_in ? formatDate(r.clock_in) : '—') + '</td>' +
        '<td>' + (r.clock_out ? formatDate(r.clock_out) : '—') + '</td>' +
        '<td>' + (r.total_hours || 0).toFixed(1) + 'h</td>' +
        '<td><span class="ta-badge ta-badge--' + statusClass + '">' + escapeHTML(r.status) + '</span></td>' +
        '<td><button class="mc-btn mc-btn--sm" data-action="edit" data-id="' + r.id + '">Edit</button></td>' +
      '</tr>');
    }

    list.innerHTML = '<div class="ta-table-wrap"><table class="ta-table"><thead><tr><th>Employee</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  } catch (err) {
    list.innerHTML = '<div class="empty-state"><h3>Failed to load attendance</h3></div>';
  }
}