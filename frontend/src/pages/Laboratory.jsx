// src/pages/Laboratory.jsx
import React, { useState, useEffect } from 'react';
import { labService } from '../api/labService';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/common/Modal';
import './Laboratory.css';
import '../App.css';

function Laboratory() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' or 'catalog'
  
  const [requests, setRequests] = useState([]);
  const [availableTests, setAvailableTests] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Action Modal State (Results)
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [resultNotes, setResultNotes] = useState('');
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  // Add Test Modal State
  const [isAddTestModalOpen, setIsAddTestModalOpen] = useState(false);
  const [newTest, setNewTest] = useState({ name: '', price: '', description: '' });

  const role = user?.user?.employee_type || '';
  const isLabTech = role === 'LAB_TECH' || role === 'ADMIN';

  useEffect(() => {
    if (activeTab === 'queue') fetchRequests();
    if (activeTab === 'catalog') fetchCatalog();
  }, [activeTab]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await labService.getTestRequests(1, 50, ''); 
      setRequests(res.data.results || []);
      setError(null);
    } catch {
      setError('Failed to load lab requests.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await labService.getAvailableTests();
      setAvailableTests(res.data.results || res.data || []);
      setError(null);
    } catch {
      setError('Failed to load test catalog.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    try {
      await labService.createLabTest(newTest);
      setNewTest({ name: '', price: '', description: '' });
      setIsAddTestModalOpen(false);
      fetchCatalog();
    } catch  {
      alert('Failed to create test.');
    }
  };

  const handleDeleteTest = async (id) => {
    if(!window.confirm("Delete this test?")) return;
    try {
      await labService.deleteLabTest(id);
      fetchCatalog();
    } catch {
      alert("Cannot delete test (it may be in use).");
    }
  };

  const handleSubmitResult = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      await labService.completeTest(selectedRequest.id, resultNotes);
      setIsResultModalOpen(false);
      fetchRequests();
    } catch {
      alert("Failed to save results.");
    }
  };

  const openResultModal = (req) => {
    setSelectedRequest(req);
    setResultNotes(req.result_notes || '');
    setIsResultModalOpen(true);
  };

  return (
    <div className="lab-page">
      <div className="lab-header">
        <h2> Laboratory Management</h2>
        <div className="lab-tabs">
            <button 
                className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`} 
                onClick={() => setActiveTab('queue')}
            >
                Patient Queue
            </button>
            <button 
                className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`} 
                onClick={() => setActiveTab('catalog')}
            >
                Test Catalog
            </button>
        </div>
      </div>
      
      {error && <p className="page-error">{error}</p>}

      {/* --- TAB 1: QUEUE --- */}
      {activeTab === 'queue' && (
        <div className="lab-list-container">
            <div style={{textAlign:'right', marginBottom:'10px'}}>
                <button onClick={fetchRequests} className="refresh-btn">↻ Refresh Queue</button>
            </div>
            <table className="lab-table">
            <thead>
                <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Test Name</th>
                <th>Doctor</th>
                <th>Status</th>
                <th>Action</th>
                </tr>
            </thead>
            <tbody>
                {loading && <tr><td colSpan="6">Loading...</td></tr>}
                {!loading && requests.length === 0 && <tr><td colSpan="6">No active requests.</td></tr>}
                {requests.map(req => (
                <tr key={req.id} className={`status-${req.status}`}>
                    <td>{new Date(req.requested_at).toLocaleDateString()}</td>
                    <td>{req.patient_name}</td>
                    <td><strong>{req.test_name}</strong></td>
                    <td>{req.doctor_name}</td>
                    <td><span className={`status-badge status-${req.status}`}>{req.status}</span></td>
                    <td>
                    {req.status !== 'COMPLETED' && isLabTech && (
                        <button onClick={() => openResultModal(req)} className="action-btn">Enter Results</button>
                    )}
                    {req.status === 'COMPLETED' && (
                        <button onClick={() => openResultModal(req)} className="view-btn">View Results</button>
                    )}
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      )}

      {/* --- TAB 2: CATALOG --- */}
      {activeTab === 'catalog' && (
        <div className="lab-list-container">
            <div style={{textAlign:'right', marginBottom:'10px'}}>
                <button onClick={() => setIsAddTestModalOpen(true)} className="submit-btn">+ Add New Test Type</button>
            </div>
            <table className="lab-table">
            <thead>
                <tr>
                <th>Test Name</th>
                <th>Description</th>
                <th>Price ($)</th>
                <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {loading && <tr><td colSpan="4">Loading...</td></tr>}
                {availableTests.map(test => (
                <tr key={test.id}>
                    <td><strong>{test.name}</strong></td>
                    <td>{test.description || '-'}</td>
                    <td>{test.price}</td>
                    <td>
                        {isLabTech && (
                            <button onClick={() => handleDeleteTest(test.id)} className="delete-btn">Delete</button>
                        )}
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      )}

      {/* --- MODALS --- */}
      {isAddTestModalOpen && (
        <Modal onClose={() => setIsAddTestModalOpen(false)} title="Add New Lab Test">
            <form onSubmit={handleCreateTest} className="lab-form">
                <div className="form-group">
                    <label>Test Name</label>
                    <input type="text" value={newTest.name} onChange={e => setNewTest({...newTest, name: e.target.value})} required />
                </div>
                <div className="form-group">
                    <label>Price</label>
                    <input type="number" step="0.01" value={newTest.price} onChange={e => setNewTest({...newTest, price: e.target.value})} required />
                </div>
                <div className="form-group">
                    <label>Description</label>
                    <input type="text" value={newTest.description} onChange={e => setNewTest({...newTest, description: e.target.value})} />
                </div>
                <button type="submit" className="submit-btn">Save Test</button>
            </form>
        </Modal>
      )}

      {isResultModalOpen && selectedRequest && (
        <Modal onClose={() => setIsResultModalOpen(false)} title={`Results: ${selectedRequest.test_name}`}>
          <div className="lab-modal-content">
            <p><strong>Patient:</strong> {selectedRequest.patient_name}</p>
            <form onSubmit={handleSubmitResult}>
                <label><strong>Findings:</strong></label>
                <textarea 
                    className="lab-textarea"
                    value={resultNotes}
                    onChange={e => setResultNotes(e.target.value)}
                    disabled={selectedRequest.status === 'COMPLETED' && !isLabTech}
                />
                {selectedRequest.status !== 'COMPLETED' && isLabTech && (
                    <button type="submit" className="submit-btn" style={{marginTop:'10px'}}>Submit Final Results</button>
                )}
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Laboratory;