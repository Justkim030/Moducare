// src/pages/Patients.jsx
import React, { useState, useEffect } from 'react';
import { patientService } from '../api/patientService';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button'; 
import './Patients.css';
import '../App.css';

function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const [newPatient, setNewPatient] = useState({
    first_name: '', second_name: '', age: '', gender: 'Male'
  });
  const [formError, setFormError] = useState(null);
  
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); 
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPatients, setTotalPatients] = useState(0);
  const [sortOrder, setSortOrder] = useState('name__first_name'); 

  useEffect(() => {
    fetchPatients();
  }, [currentPage, pageSize, sortOrder]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await patientService.getAllPatients(currentPage, pageSize, sortOrder);
      setPatients(response.data.results || response.data || []);
      setTotalPatients(response.data.count || 0);
      setError(null);
    } catch {
      setError('Failed to fetch patients. Your session may be expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    setNewPatient({
      ...newPatient,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    
    // REST nested payload restructuring
    const backendPayload = {
      name: {
        first_name: newPatient.first_name,
        second_name: newPatient.second_name || '',
        age: newPatient.age ? parseInt(newPatient.age, 10) : null,
        gender: newPatient.gender
      }
    };

    try {
      await patientService.createPatient(backendPayload);
      setSuccessMessage(`Patient record for "${newPatient.first_name}" created successfully.`);
      setIsAddModalOpen(false);
      setNewPatient({ first_name: '', second_name: '', age: '', gender: 'Male' });
      fetchPatients();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Validation failed. Check your inputs.');
    }
  };

  const handleDeleteClick = (patient) => {
    setDeleteConfirmation(patient);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      await patientService.deletePatient(deleteConfirmation.id);
      setSuccessMessage('Patient record successfully deactivated.');
      setDeleteConfirmation(null);
      fetchPatients();
    } catch {
      setError('Failed to process record deactivation.');
    }
  };

  const totalPages = Math.ceil(totalPatients / pageSize);

  return (
    <div className="patients-page">
      {/* Balanced Header Row eliminating awkward spaces */}
      <div className="patient-header-row">
        <h2>Patient Database Index</h2>
        <Button onClick={() => setIsAddModalOpen(true)} variant="submit">
          + Register New Patient
        </Button>
      </div>

      {successMessage && <p className="page-success">{successMessage}</p>}
      {error && <p className="page-error">{error}</p>}

      <div className="patient-list-container">
        <table className="patient-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Gender</th>
              <th>Age Status</th>
              <th>Actions Control</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              /* Shimmering Layout Skeleton Structure Rows */
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`skeleton-patient-${index}`} className="skeleton-row">
                  <td><div className="skeleton-block skeleton-text" style={{ width: '180px' }}></div></td>
                  <td><div className="skeleton-block skeleton-badge" style={{ width: '60px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '45px' }}></div></td>
                  <td><div className="skeleton-block skeleton-btn" style={{ width: '80px' }}></div></td>
                </tr>
              ))
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center">No matching records found in database.</td>
              </tr>
            ) : (
              patients.map((patient) => (
                <tr key={patient.id}>
                  <td>
                    <strong>
                      {patient.name?.first_name} {patient.name?.second_name || ''}
                    </strong>
                  </td>
                  <td>
                    <span className={`gender-badge gender-${patient.name?.gender?.toLowerCase()}`}>
                      {patient.name?.gender || 'N/A'}
                    </span>
                  </td>
                  <td>{patient.name?.age || '—'}</td>
                  <td>
                    <div className="action-button-group">
                      <Button variant="delete" onClick={() => handleDeleteClick(patient)}>
                        Deactivate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Modern Compact Control Flow Pagination Panel */}
        {!loading && totalPages > 1 && (
          <div className="pagination-controls">
            <span className="page-info">Showing page {currentPage} of {totalPages}</span>
            <div className="pagination-buttons">
              <Button 
                variant="edit"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                &larr; Previous
              </Button>
              <Button 
                variant="edit"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next &rarr;
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {deleteConfirmation && (
        <Modal onClose={() => setDeleteConfirmation(null)}>
          <div className="delete-modal-inner">
            <h3>Deactivate Patient Profile</h3>
            <p>
              Are you sure you want to deactivate records for{' '}
              <strong>{deleteConfirmation.name?.first_name} {deleteConfirmation.name?.second_name}</strong>?
            </p>
            <div className="modal-actions">
              <Button onClick={confirmDelete} variant="delete">Confirm Archive</Button>
              <Button onClick={() => setDeleteConfirmation(null)} variant="edit">Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Grid Organized Responsive Entry Overlay Modal */}
      {isAddModalOpen && (
        <Modal onClose={() => setIsAddModalOpen(false)}>
          <div className="add-patient-form-modal">
            <h3>Register New Patient</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>First Name*</label>
                <input type="text" name="first_name" value={newPatient.first_name} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Second Name</label>
                <input type="text" name="second_name" value={newPatient.second_name} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Age</label>
                <input type="number" name="age" value={newPatient.age} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={newPatient.gender} onChange={handleFormChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              {formError && <p className="form-error span-two">{formError}</p>}

              <Button type="submit" variant="submit" className="span-two">
                Register Patient
              </Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Patients;