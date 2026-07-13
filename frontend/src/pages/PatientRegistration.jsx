import React, { useState, useEffect } from 'react';
import { patientService } from '../api/patientService';
import { visitService } from '../api/visitService';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/common/Modal'; 
import Button from '../components/common/Button'; 
import './PatientRegistration.css';
import '../App.css';

function PatientRegistration() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); 
  const [formError, setFormError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [newPatientData, setNewPatientData] = useState({
    first_name: '', second_name: '', age: '', gender: 'Male', phone_number: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchActiveQueue();
  }, [currentPage]);

  const fetchActiveQueue = async () => {
    try {
      setLoading(true);
      const res = await visitService.getVisits('', currentPage, 10);
      setVisits(res.data.results || []);
      setTotalPages(Math.ceil((res.data.count || 1) / 10));
      setError(null);
    } catch {
      setError('Failed to pull triage waitlist registries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const search = async () => {
      try {
        const res = await patientService.searchPatients(searchQuery);
        setSearchResults(res.data.results || res.data || []);
      } catch {
        setSearchResults([]);
      }
    };
    const timerId = setTimeout(() => search(), 300);
    return () => clearTimeout(timerId);
  }, [searchQuery]);

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    setFormError(null);

    const dataToSend = {
      name: {
        first_name: newPatientData.first_name,
        second_name: newPatientData.second_name,
        age: newPatientData.age || null,
        gender: newPatientData.gender,
        phone_number: newPatientData.phone_number
      }
    };

    try {
      const res = await patientService.createPatient(dataToSend);
      setIsAddModalOpen(false); 
      setNewPatientData({ first_name: '', second_name: '', age: '', gender: 'Male', phone_number: '' }); 
      navigate(`/triage-assessment/${res.data.id}`); 
    } catch {
      setFormError('Failed to create new patient.');
    }
  };

  const handleNewPatientChange = (e) => {
    const { name, value } = e.target;
    setNewPatientData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="registration-page">
      {/* Horizontal Header Row aligning title, matched search bar width, and action button */}
      <div className="registration-top-header-row">
        <h2>Patient Check-in Ledger</h2>
        <div className="registration-control-action-group">
          <div className="search-wrapper">
            <input 
              type="text"
              placeholder="Search by first name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searchQuery.length >= 2 && (
              <ul className="search-results">
                {searchResults.length > 0 ? (
                  searchResults.map(p => (
                    <li key={p.id} onClick={() => navigate(`/triage-assessment/${p.id}`)}>
                      <span>{p.name?.first_name} {p.name?.second_name} (Age: {p.name?.age})</span>
                      <button type="button" className="submit-btn-small">Send to Triage</button>
                    </li>
                  ))
                ) : (
                  <li className="no-results">No records found matching criteria.</li>
                )}
              </ul>
            )}
          </div>
          
          <Button onClick={() => setIsAddModalOpen(true)} variant="secondary">
            Register New Patient +
          </Button>
        </div>
      </div>

      {error && <p className="page-error">{error}</p>}

      {/* Admissions Queue Table View Container */}
      <div className="patient-list-container">
        <h3>Current Admissions Queue</h3>
        <table className="registration-table">
          <thead>
            <tr>
              <th>Patient Reference</th>
              <th>Gender</th>
              <th>Contact Phone</th>
              <th>Status State</th>
              <th>Action Panel</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              /* Shimmering Layout Skeleton Structure Rows */
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-reg-${idx}`} className="skeleton-row">
                  <td><div className="skeleton-block skeleton-text" style={{ width: '160px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '60px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '110px' }}></div></td>
                  <td><div className="skeleton-block skeleton-badge" style={{ width: '85px' }}></div></td>
                  <td><div className="skeleton-block skeleton-btn" style={{ width: '90px' }}></div></td>
                </tr>
              ))
            ) : visits.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No active clinic visits or waiting patients discovered.
                </td>
              </tr>
            ) : (
              visits.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.patient_name || `Patient Record #${v.patient}`}</strong></td>
                  <td>{v.patient_gender || '—'}</td>
                  <td>{v.patient_phone || '—'}</td>
                  <td>
                    <span className={`status-badge status-${v.status}`}>
                      {v.status}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="submit-btn-small" 
                      onClick={() => navigate(`/triage-assessment/${v.patient}`)}
                    >
                      Update Metrics
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && totalPages > 1 && (
          <div className="pagination-controls">
            <div className="pagination-buttons">
              <button 
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              >
                &larr; Prev
              </button>
              <span className="page-info">Page {currentPage} of {totalPages}</span>
              <button 
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grid Organized Patient Onboarding Overlay */}
      {isAddModalOpen && (
        <Modal onClose={() => setIsAddModalOpen(false)} title="Register New Patient">
          <div className="add-patient-form-modal">
            {formError && <p className="form-error">{formError}</p>}
            <form onSubmit={handleCreatePatient}>
              <div className="form-group">
                <label>First Name*</label>
                <input type="text" name="first_name" value={newPatientData.first_name} onChange={handleNewPatientChange} required />
              </div>
              <div className="form-group">
                <label>Second Name</label>
                <input type="text" name="second_name" value={newPatientData.second_name} onChange={handleNewPatientChange} />
              </div>
              <div className="form-group">
                <label>Age</label>
                <input type="number" name="age" value={newPatientData.age} onChange={handleNewPatientChange} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={newPatientData.gender} onChange={handleNewPatientChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="form-group span-two">
                <label>Phone Number</label>
                <input type="number" name="phone_number" value={newPatientData.phone_number} onChange={handleNewPatientChange} />
              </div>
              <button type="submit" className="submit-btn span-two">Create & Send to Triage</button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PatientRegistration;