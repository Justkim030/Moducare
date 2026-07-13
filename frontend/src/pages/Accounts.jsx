// src/pages/Accounts.jsx
import React, { useState, useEffect } from 'react';
import { accountService } from '../api/accountService';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button'; 
import './Accounts.css';
import '../App.css';

function Accounts() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [filterStatus, setFilterStatus] = useState(''); // '' = All, 'PENDING', 'PAID'

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: 'CASH',
    reference_number: ''
  });

  useEffect(() => {
    fetchInvoices();
  }, [currentPage, pageSize, filterStatus]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await accountService.getAllInvoices(currentPage, pageSize, '-issued_at', filterStatus);
      setInvoices(res.data.results || []);
      setTotalInvoices(res.data.count || 0);
      setError(null);
    } catch {
      setError('Failed to fetch medical billing invoices.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: invoice.balance,
      method: 'CASH',
      reference_number: ''
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await accountService.createPayment(selectedInvoice.id, paymentData);
      setSuccess(`Payment of $${paymentData.amount} registered successfully for Invoice #${selectedInvoice.id.toString().slice(-4)}`);
      setIsPaymentModalOpen(false);
      fetchInvoices();
    } catch {
      setError('Failed to record transaction reference item.');
    }
  };

  const totalPages = Math.ceil(totalInvoices / pageSize);

  return (
    <div className="accounts-page">
      {/* Sleek Header Row eliminating vertical Dead Space */}
      <div className="accounts-header-row">
        <h2>Billing & Financial Ledger</h2>
        <div className="accounts-filter-group">
          <label htmlFor="statusFilter">Status:</label>
          <select 
            id="statusFilter"
            value={filterStatus} 
            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Transactions</option>
            <option value="PENDING">Pending Invoices</option>
            <option value="PARTIAL">Partially Paid</option>
            <option value="PAID">Settled / Paid</option>
          </select>
        </div>
      </div>

      {success && <p className="page-success">{success}</p>}
      {error && <p className="page-error">{error}</p>}

      <div className="accounts-list-container">
        <table className="accounts-table">
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Patient Name</th>
              <th>Total Amount</th>
              <th>Balance Due</th>
              <th>Status</th>
              <th>Issued Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              /* Shimmering Layout Skeleton Table Structure Rows */
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="skeleton-row">
                  <td><div className="skeleton-block skeleton-text" style={{ width: '55px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '140px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '65px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '65px' }}></div></td>
                  <td><div className="skeleton-block skeleton-badge" style={{ width: '75px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '90px' }}></div></td>
                  <td><div className="skeleton-block skeleton-btn" style={{ width: '100px' }}></div></td>
                </tr>
              ))
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No financial entries discovered matching criteria.</td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>#{inv.id.toString().slice(-4)}</td>
                  <td><strong>{inv.patient_name || `Patient #${inv.patient}`}</strong></td>
                  <td>${Number(inv.total_amount).toFixed(2)}</td>
                  <td className={inv.balance > 0 ? 'text-danger' : 'text-success'}>
                    ${Number(inv.balance).toFixed(2)}
                  </td>
                  <td>
                    <span className={`status-badge status-${inv.status}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td>{new Date(inv.issued_at).toLocaleDateString()}</td>
                  <td>
                    {inv.balance > 0 ? (
                      <Button variant="submit" onClick={() => handleOpenPayment(inv)} style={{ padding: '4px 10px', fontSize: '0.85rem' }}>
                        Collect Payment
                      </Button>
                    ) : (
                      <span className="text-success" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Settled</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && totalPages > 1 && (
          <div className="pagination-controls" style={{ marginTop: '20px', display: 'flex', gap: '5px', alignItems: 'center' }}>
            <Button 
              variant="edit"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
            >
              &larr; Previous
            </Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button 
              variant="edit"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
            >
              Next &rarr;
            </Button>
          </div>
        )}
      </div>

      {/* Collect Payment Modal Display Box */}
      {isPaymentModalOpen && selectedInvoice && (
        <Modal onClose={() => setIsPaymentModalOpen(false)}>
          <div className="payment-form-modal">
            <h3>Process Cashless / Cash Payment</h3>
            <p style={{ margin: '-5px 0 15px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Invoice total: <strong>${selectedInvoice.total_amount}</strong> | Outstanding: <strong>${selectedInvoice.balance}</strong>
            </p>
            <form onSubmit={handlePaymentSubmit}>
              <div className="form-group">
                <label>Amount to Pay ($)*</label>
                <input 
                  type="number" 
                  step="0.01"
                  max={selectedInvoice.balance} 
                  value={paymentData.amount}
                  onChange={e => setPaymentData({...paymentData, amount: e.target.value})}
                  required 
                />
              </div>
              
              <div className="form-group">
                <label>Payment Method</label>
                <select 
                  value={paymentData.method}
                  onChange={e => setPaymentData({...paymentData, method: e.target.value})}
                >
                  <option value="CASH">Cash</option>
                  <option value="MPESA">M-Pesa</option>
                  <option value="CARD">Card</option>
                  <option value="INSURANCE">Insurance</option>
                </select>
              </div>

              <div className="form-group span-two">
                <label>Reference No. (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Transaction ID / Slip Code"
                  value={paymentData.reference_number}
                  onChange={e => setPaymentData({...paymentData, reference_number: e.target.value})}
                />
              </div>
              
              <Button type="submit" variant="submit" className="span-two" style={{ marginTop: '10px' }}>
                Confirm Payment
              </Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Accounts;