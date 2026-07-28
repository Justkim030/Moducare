// src/pages/Referrals.jsx
import React, { useState, useEffect } from 'react';
import { referralsService } from '../api/referralsService';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';

const STATUSES = ['pending', 'accepted', 'completed', 'rejected'];

function Referrals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    patient: '',
    referred_by: '',
    referred_to: '',
    reason: '',
    status: 'pending',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await referralsService.getReferrals();
      setItems(res.data.results || res.data || []);
      setError(null);
    } catch (e) {
      setError('Failed to load referrals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await referralsService.createReferral(form);
      setSuccess('Referral created.');
      setIsOpen(false);
      setForm({ patient: '', referred_by: '', referred_to: '', reason: '', status: 'pending' });
      load();
    } catch (e) {
      setError(e.response?.data ? JSON.stringify(e.response.data) : 'Failed to create referral.');
    }
  };

  return (
    <div className="referrals-page">
      <div className="staff-header-row">
        <h2>Referrals</h2>
        <Button variant="submit" onClick={() => setIsOpen(true)}>+ New Referral</Button>
      </div>
      {success && <p className="page-success">{success}</p>}
      {error && <p className="page-error">{error}</p>}

      {loading ? (
        <p className="hr-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="hr-muted">No referrals.</p>
      ) : (
        <table className="hr-table">
          <thead>
            <tr><th>ID</th><th>Patient</th><th>Referred By</th><th>Referred To</th><th>Reason</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.patient ?? '—'}</td>
                <td>{r.referred_by ?? '—'}</td>
                <td>{r.referred_to ?? '—'}</td>
                <td>{r.reason || '—'}</td>
                <td><span className={`status-badge status-${r.status}`}>{r.status}</span></td>
                <td>{r.referral_date ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isOpen && (
        <Modal onClose={() => setIsOpen(false)}>
          <div className="hr-form-modal">
            <h3>New Referral</h3>
            <form onSubmit={submit}>
              <div className="form-group"><label>Patient ID</label>
                <input name="patient" value={form.patient} onChange={onChange} required /></div>
              <div className="form-group"><label>Referred By (User ID)</label>
                <input name="referred_by" value={form.referred_by} onChange={onChange} /></div>
              <div className="form-group"><label>Referred To (User ID)</label>
                <input name="referred_to" value={form.referred_to} onChange={onChange} /></div>
              <div className="form-group"><label>Status</label>
                <select name="status" value={form.status} onChange={onChange}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div className="form-group span-two"><label>Reason</label>
                <textarea name="reason" value={form.reason} onChange={onChange} required /></div>
              <Button type="submit" variant="submit" className="span-two">Create</Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Referrals;
