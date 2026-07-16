// src/pages/HR.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../api/hrService';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import './HR.css';

const LEAVE_STATUSES = ['pending', 'approved', 'rejected'];
const ATTENDANCE_STATUSES = ['present', 'absent', 'leave'];

function HR() {
  const [tab, setTab] = useState('leave');
  const [directory, setDirectory] = useState({ userToStaff: {}, userToName: {}, staffList: [] });
  const [staffId, setStaffId] = useState(null);

  // Leave state
  const [leaves, setLeaves] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'Annual',
    start_date: '',
    end_date: '',
    reason: '',
  });

  // Attendance state
  const [attendance, setAttendance] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState(null);
  const [isAttModalOpen, setIsAttModalOpen] = useState(false);
  const [attForm, setAttForm] = useState({
    date: '',
    status: 'present',
    check_in: '',
    check_out: '',
  });

  const [success, setSuccess] = useState(null);

  const loadDirectory = useCallback(async () => {
    const dir = await hrService.loadEmployeeDirectory();
    setDirectory(dir);
    if (dir.staffList.length > 0) setStaffId(dir.staffList[0].id);
    return dir;
  }, []);

  const loadLeaves = useCallback(async (dir) => {
    setLeaveLoading(true);
    try {
      const res = await hrService.getLeaves();
      setLeaves(res.data.results || res.data || []);
      setLeaveError(null);
    } catch (err) {
      setLeaveError('Failed to load leave requests.');
    } finally {
      setLeaveLoading(false);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    setAttLoading(true);
    try {
      const res = await hrService.getAttendance();
      setAttendance(res.data.results || res.data || []);
      setAttError(null);
    } catch (err) {
      setAttError('Failed to load attendance records.');
    } finally {
      setAttLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const dir = await loadDirectory();
      await loadLeaves(dir);
      await loadAttendance();
    })();
  }, [loadDirectory, loadLeaves, loadAttendance]);

  const employeeName = (empFk) => directory.userToName[empFk] || `Staff #${empFk}`;

  const handleLeaveChange = (e) =>
    setLeaveForm({ ...leaveForm, [e.target.name]: e.target.value });

  const submitLeave = async (e) => {
    e.preventDefault();
    if (!staffId) return setLeaveError('No staff record available to attach the request.');
    try {
      await hrService.createLeave({ ...leaveForm, employee: staffId });
      setSuccess('Leave request submitted.');
      setIsLeaveModalOpen(false);
      setLeaveForm({ leave_type: 'Annual', start_date: '', end_date: '', reason: '' });
      await loadLeaves();
    } catch (err) {
      setLeaveError(err.response?.data ? JSON.stringify(err.response.data) : 'Failed to submit leave request.');
    }
  };

  const setLeaveStatus = async (id, status) => {
    try {
      await hrService.updateLeave(id, { status });
      setSuccess(`Leave ${status}.`);
      await loadLeaves();
    } catch (err) {
      setLeaveError('Failed to update leave status.');
    }
  };

  const handleAttChange = (e) =>
    setAttForm({ ...attForm, [e.target.name]: e.target.value });

  const submitAttendance = async (e) => {
    e.preventDefault();
    if (!staffId) return setAttError('No staff record available to attach the entry.');
    try {
      await hrService.createAttendance({ ...attForm, employee: staffId });
      setSuccess('Attendance entry recorded.');
      setIsAttModalOpen(false);
      setAttForm({ date: '', status: 'present', check_in: '', check_out: '' });
      await loadAttendance();
    } catch (err) {
      setAttError(err.response?.data ? JSON.stringify(err.response.data) : 'Failed to record attendance.');
    }
  };

  return (
    <div className="hr-page">
      <div className="hr-header-row">
        <h2>Human Resources</h2>
        {staffId == null && <span className="hr-warn">No linked staff record — acts will be disabled.</span>}
      </div>

      {success && <p className="page-success">{success}</p>}
      {tab === 'leave' && leaveError && <p className="page-error">{leaveError}</p>}
      {tab === 'attendance' && attError && <p className="page-error">{attError}</p>}

      <div className="hr-tabs">
        <button className={`hr-tab ${tab === 'leave' ? 'active' : ''}`} onClick={() => setTab('leave')}>
          Leave Requests
        </button>
        <button className={`hr-tab ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>
          Time &amp; Attendance
        </button>
      </div>

      {tab === 'leave' && (
        <section className="hr-panel">
          <div className="hr-panel-header">
            <h3>Leave Requests</h3>
            <Button variant="submit" onClick={() => setIsLeaveModalOpen(true)} disabled={staffId == null}>
              + New Leave Request
            </Button>
          </div>

          {leaveLoading ? (
            <p className="hr-muted">Loading…</p>
          ) : leaves.length === 0 ? (
            <p className="hr-muted">No leave requests yet.</p>
          ) : (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td>{employeeName(l.employee)}</td>
                    <td>{l.leave_type}</td>
                    <td>{l.start_date}</td>
                    <td>{l.end_date}</td>
                    <td>{l.reason || '—'}</td>
                    <td>
                      <span className={`status-badge status-${l.status}`}>{l.status}</span>
                    </td>
                    <td>
                      <div className="action-button-group">
                        {l.status === 'pending' && (
                          <>
                            <Button variant="submit" onClick={() => setLeaveStatus(l.id, 'approved')}>Approve</Button>
                            <Button variant="delete" onClick={() => setLeaveStatus(l.id, 'rejected')}>Reject</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'attendance' && (
        <section className="hr-panel">
          <div className="hr-panel-header">
            <h3>Time &amp; Attendance</h3>
            <Button variant="submit" onClick={() => setIsAttModalOpen(true)} disabled={staffId == null}>
              + Record Entry
            </Button>
          </div>

          {attLoading ? (
            <p className="hr-muted">Loading…</p>
          ) : attendance.length === 0 ? (
            <p className="hr-muted">No attendance records yet.</p>
          ) : (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id}>
                    <td>{employeeName(a.employee)}</td>
                    <td>{a.date}</td>
                    <td>{a.check_in || '—'}</td>
                    <td>{a.check_out || '—'}</td>
                    <td>
                      <span className={`status-badge status-${a.status}`}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {isLeaveModalOpen && (
        <Modal onClose={() => setIsLeaveModalOpen(false)}>
          <div className="hr-form-modal">
            <h3>New Leave Request</h3>
            <form onSubmit={submitLeave}>
              <div className="form-group">
                <label>Leave Type</label>
                <input name="leave_type" value={leaveForm.leave_type} onChange={handleLeaveChange} required />
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" name="start_date" value={leaveForm.start_date} onChange={handleLeaveChange} required />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" name="end_date" value={leaveForm.end_date} onChange={handleLeaveChange} required />
              </div>
              <div className="form-group span-two">
                <label>Reason</label>
                <textarea name="reason" value={leaveForm.reason} onChange={handleLeaveChange} />
              </div>
              <Button type="submit" variant="submit" className="span-two">Submit Request</Button>
            </form>
          </div>
        </Modal>
      )}

      {isAttModalOpen && (
        <Modal onClose={() => setIsAttModalOpen(false)}>
          <div className="hr-form-modal">
            <h3>Record Attendance</h3>
            <form onSubmit={submitAttendance}>
              <div className="form-group">
                <label>Date</label>
                <input type="date" name="date" value={attForm.date} onChange={handleAttChange} required />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select name="status" value={attForm.status} onChange={handleAttChange}>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Check In</label>
                <input type="time" name="check_in" value={attForm.check_in} onChange={handleAttChange} />
              </div>
              <div className="form-group">
                <label>Check Out</label>
                <input type="time" name="check_out" value={attForm.check_out} onChange={handleAttChange} />
              </div>
              <Button type="submit" variant="submit" className="span-two">Record Entry</Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default HR;
