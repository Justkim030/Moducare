// src/pages/Staff.jsx
import React, { useState, useEffect } from 'react';
import { userService } from '../api/userService';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button'; 
import './Staff.css';

function Staff() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Clean initial state representation
  const initialFormState = {
    username: '', 
    password: '', 
    first_name: '', 
    second_name: '',
    age: '', 
    gender: 'Male', 
    phone_number: '', 
    employee_type: 'DOCTOR', 
    email: ''
  };

  const [newEmployee, setNewEmployee] = useState(initialFormState);
  const [formError, setFormError] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [sortOrder] = useState('user__name__first_name'); 

  useEffect(() => {
    fetchStaff();
  }, [currentPage, pageSize, sortOrder]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await userService.getAllEmployees(currentPage, pageSize, sortOrder);
      setEmployees(response.data.results || []);
      setTotalEmployees(response.data.count || 0);
      setError(null);
    } catch (err) {
      setError('Failed to fetch system employees registry records.', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    setNewEmployee({
      ...newEmployee,
      [e.target.name]: e.target.value
    });
  };
const handleAddEmployeeSubmit = async (e) => {
    // 1. Force absolute prevention of HTML native form bubble-up reloads
    e.preventDefault();
    e.stopPropagation();
    setFormError(null);

    const backendData = {
      // Keep it here if the root profile table requires it
      employee_type: newEmployee.employee_type,
      email: newEmployee.email, 
      user: {
        username: newEmployee.username,
        password: newEmployee.password,
        
        employee_type: newEmployee.employee_type, 

        name: {
          first_name: newEmployee.first_name,
          second_name: newEmployee.second_name || '',
          age: newEmployee.age ? parseInt(newEmployee.age, 10) : null,
          gender: newEmployee.gender,
          phone_number: newEmployee.phone_number || ''
        }
      }
    };

    try {
      console.log("OUTBOUND MULTI-TABLE PAYLOAD DEPLOYED:", backendData);
      const response = await userService.createEmployee(backendData);
      
      // Absolute verification of success before structural reset
      if (response && (response.status === 200 || response.status === 201)) {
        setSuccessMessage(`Employee account "${newEmployee.username}" provisioned successfully.`);
        setIsAddModalOpen(false);
        setNewEmployee(initialFormState); 
        fetchStaff();
      }
    } catch (err) {
      console.error("CRITICAL EXCEPTION REVEALED:", err);
      
      // 2. Extract error variations directly out of Axios or native Fetch instances
      const responseBody = err.response?.data;
      const responseStatus = err.response?.status;
      const genericMessage = err.message;

      let printedErrorString = `[Status ${responseStatus || 'Unknown'}] `;

      if (responseBody) {
        printedErrorString += typeof responseBody === 'string' 
          ? responseBody 
          : JSON.stringify(responseBody);
      } else {
        printedErrorString += `System Exception Message: ${genericMessage || 'No descriptive error token extracted.'}`;
      }

      // 3. Inject explicit alert call to freeze execution thread if state is wiping
      alert(`STOP DETECTED!\nBackend Database Rejected Save Transaction.\n\nReason:\n${printedErrorString}`);
      
      setFormError(`Database Validation Error: ${printedErrorString}`);
    }
  };

  const handleDeleteClick = (employee) => {
    setDeleteConfirmation(employee);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      await userService.deleteEmployee(deleteConfirmation.id);
      setSuccessMessage('Employee record deactivated successfully.');
      setDeleteConfirmation(null);
      fetchStaff();
    } catch (err) {
      setError('Failed to terminate target user credentials profile.', err);
    }
  };

  const totalPages = Math.ceil(totalEmployees / pageSize);

  return (
    <div className="staff-page">
      <div className="staff-header-row">
        <h2>Staff Management</h2>
        <Button onClick={() => setIsAddModalOpen(true)} variant="submit">
          + Add New Employee
        </Button>
      </div>

      {successMessage && <p className="page-success">{successMessage}</p>}
      {error && <p className="page-error">{error}</p>}

      <div className="staff-list-container">
        <table className="staff-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>Role Designation</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="skeleton-row">
                  <td><div className="skeleton-block skeleton-text" style={{ width: '70px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '140px' }}></div></td>
                  <td><div className="skeleton-block skeleton-badge" style={{ width: '90px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '100px' }}></div></td>
                  <td><div className="skeleton-block skeleton-btn" style={{ width: '75px' }}></div></td>
                </tr>
              ))
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center">No active team members registered.</td>
              </tr>
            ) : (
              employees.map((emp) => {
                const activeRole = emp.employee_type || emp.user?.employee_type || 'STAFF';
                return (
                  <tr key={emp.id}>
                    <td>{emp.user?.username || 'unknown'}</td>
                    <td>
                      <strong>
                        {emp.user?.name?.first_name} {emp.user?.name?.second_name || ''}
                      </strong>
                    </td>
                    <td>
                      <span className={`role-badge role-${activeRole.toLowerCase()}`}>
                        {activeRole.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{emp.user?.name?.phone_number || 'N/A'}</td>
                    <td>
                      <div className="action-button-group">
                        <Button variant="delete" onClick={() => handleDeleteClick(emp)}>
                          Deactivate
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {!loading && totalPages > 1 && (
          <div className="pagination-controls">
            <Button 
              variant="edit"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              &larr; Previous
            </Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button 
              variant="edit"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next &rarr;
            </Button>
          </div>
        )}
      </div>

      {deleteConfirmation && (
        <Modal onClose={() => setDeleteConfirmation(null)}>
          <div className="delete-modal-inner">
            <h3>Confirm Credential Deactivation</h3>
            <p>
              Are you sure you want to completely suspend clinical platform access permissions for{' '}
              <strong>{deleteConfirmation.user?.username}</strong>? This workflow cannot be undone.
            </p>
            <div className="modal-actions">
              <Button onClick={confirmDelete} variant="delete">
                Yes, Deactivate
              </Button>
              <Button onClick={() => setDeleteConfirmation(null)} variant="edit">
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isAddModalOpen && (
        <Modal onClose={() => setIsAddModalOpen(false)}>
          <div className="add-employee-form-modal">
            <h3>Add New Employee Entry</h3>
            <form onSubmit={handleAddEmployeeSubmit}>
              <div className="form-group">
                <label>System Username</label>
                <input type="text" name="username" value={newEmployee.username} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Access Password</label>
                <input type="password" name="password" value={newEmployee.password} onChange={handleFormChange} required />
              </div>
              <div className="form-group span-two">
                <label>Email Address</label>
                <input type="email" name="email" value={newEmployee.email} onChange={handleFormChange} required />
              </div>
              <div className="form-group span-two">
                <label>Role / Operational Designation</label>
                <select name="employee_type" value={newEmployee.employee_type} onChange={handleFormChange}>
                  <option value="DOCTOR">Doctor</option>
                  <option value="NURSE">Nurse</option>
                  <option value="CHEMIST">Pharmacist / Chemist</option>
                  <option value="LAB_TECH">Lab Technician</option>
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="RECEPTIONIST">Reception / Triage</option>
                  <option value="STORE_MANAGER">Store Manager</option>
                  <option value="QUALITY_ASSURANCE">Quality Assurance Officer</option>
                </select>
              </div>
              <div className="form-group">
                <label>First Name</label>
                <input type="text" name="first_name" value={newEmployee.first_name} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Second Name</label>
                <input type="text" name="second_name" value={newEmployee.second_name} onChange={handleFormChange} />
              </div>
              <div className="form-group span-two">
                <label>Phone Number</label>
                <input type="text" name="phone_number" value={newEmployee.phone_number} onChange={handleFormChange} placeholder="e.g. 0712345678" />
              </div>
              <div className="form-group">
                <label>Age</label>
                <input type="number" name="age" value={newEmployee.age} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={newEmployee.gender} onChange={handleFormChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {formError && <p className="form-error span-two">{formError}</p>}

              <Button type="submit" variant="submit" className="span-two">
                Add Employee
              </Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Staff;