// src/pages/Appointments.jsx
import React, { useState, useEffect } from 'react';
import { appointmentsService } from '../api/appointmentsService';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import './Appointments.css';

const STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'];

function Appointments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    patient: '',
    doctor: '',
    appointment_date: '',
    status: 'scheduled',
    notes: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await appointmentsService.getAppointments();
      setItems(res.data.results || res.data || []);
      setError(null);
    } catch (e) {
      setError('Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await appointmentsService.createAppointment(form);
      setSuccess('Appointment scheduled.');
      setIsOpen(false);
      setForm({ patient: '', doctor: '', appointment_date: '', status: 'scheduled', notes: '' });
      load();
    } catch (e) {
      setError(e.response?.data ? JSON.stringify(e.response.data) : 'Failed to schedule appointment.');
    }
  };

  return (
    <div className="appointments-page">
      <div className="staff-header-row">
        <h2>Appointments</h2>
        <Button variant="submit" onClick={() => setIsOpen(true)}>+ New Appointment</Button>
      </div>
      {success && <p className="page-success">{success}</p>}
      {error && <p className="page-error">{error}</p>}

      {loading ? (
        <p className="hr-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="hr-muted">No appointments scheduled.</p>
      ) : (
        <table className="hr-table">
          <thead>
            <tr><th>ID</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Status</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td>{a.patient ?? '—'}</td>
                <td>{a.doctor ?? '—'}</td>
                <td>{a.appointment_date ?? '—'}</td>
                <td><span className={`status-badge status-${a.status}`}>{a.status}</span></td>
                <td>{a.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isOpen && (
        <Modal onClose={() => setIsOpen(false)}>
          <div className="hr-form-modal">
            <h3>New Appointment</h3>
            <form onSubmit={submit}>
              <div className="form-group"><label>Patient ID</label>
                <input name="patient" value={form.patient} onChange={onChange} required /></div>
              <div className="form-group"><label>Doctor ID</label>
                <input name="doctor" value={form.doctor} onChange={onChange} /></div>
              <div className="form-group"><label>Date/Time</label>
                <input type="datetime-local" name="appointment_date" value={form.appointment_date} onChange={onChange} required /></div>
              <div className="form-group"><label>Status</label>
                <select name="status" value={form.status} onChange={onChange}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div className="form-group span-two"><label>Notes</label>
                <textarea name="notes" value={form.notes} onChange={onChange} /></div>
              <Button type="submit" variant="submit" className="span-two">Schedule</Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Appointments;
