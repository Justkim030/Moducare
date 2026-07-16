// src/pages/Finance.jsx
import React, { useState, useEffect } from 'react';
import { financeService } from '../api/financeService';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import './Finance.css';

const TYPES = ['income', 'expense', 'adjustment'];

function Finance() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    transaction_type: 'income',
    amount: '',
    description: '',
    date: '',
    category: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await financeService.getTransactions();
      setItems(res.data.results || res.data || []);
      setError(null);
    } catch (e) {
      setError('Failed to load financial transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await financeService.createTransaction({ ...form, amount: parseFloat(form.amount) });
      setSuccess('Transaction recorded.');
      setIsOpen(false);
      setForm({ transaction_type: 'income', amount: '', description: '', date: '', category: '' });
      load();
    } catch (e) {
      setError(e.response?.data ? JSON.stringify(e.response.data) : 'Failed to record transaction.');
    }
  };

  return (
    <div className="finance-page">
      <div className="staff-header-row">
        <h2>Finance &amp; Billing</h2>
        <Button variant="submit" onClick={() => setIsOpen(true)}>+ New Transaction</Button>
      </div>
      {success && <p className="page-success">{success}</p>}
      {error && <p className="page-error">{error}</p>}

      {loading ? (
        <p className="hr-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="hr-muted">No transactions recorded.</p>
      ) : (
        <table className="hr-table">
          <thead>
            <tr><th>ID</th><th>Type</th><th>Amount</th><th>Category</th><th>Date</th><th>Description</th></tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td><span className={`status-badge status-${t.transaction_type}`}>{t.transaction_type}</span></td>
                <td>{t.amount}</td>
                <td>{t.category || '—'}</td>
                <td>{t.date ?? '—'}</td>
                <td>{t.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isOpen && (
        <Modal onClose={() => setIsOpen(false)}>
          <div className="hr-form-modal">
            <h3>New Transaction</h3>
            <form onSubmit={submit}>
              <div className="form-group"><label>Type</label>
                <select name="transaction_type" value={form.transaction_type} onChange={onChange}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select></div>
              <div className="form-group"><label>Amount</label>
                <input type="number" step="0.01" name="amount" value={form.amount} onChange={onChange} required /></div>
              <div className="form-group"><label>Date/Time</label>
                <input type="datetime-local" name="date" value={form.date} onChange={onChange} /></div>
              <div className="form-group"><label>Category</label>
                <input name="category" value={form.category} onChange={onChange} /></div>
              <div className="form-group span-two"><label>Description</label>
                <textarea name="description" value={form.description} onChange={onChange} /></div>
              <Button type="submit" variant="submit" className="span-two">Record</Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Finance;
