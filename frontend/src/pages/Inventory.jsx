// src/pages/Inventory.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { inventoryService } from '../api/inventoryService';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button'; // Shared custom UI button element
import './Inventory.css';
import '../App.css';

function Inventory() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [newMed, setNewMed] = useState({ name: '', quantity: 0, price: 0.00 });
  const [formError, setFormError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); 
  const [editingMed, setEditingMed] = useState(null);
  const [editFormError, setEditFormError] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); 
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalMedicines, setTotalMedicines] = useState(0);
  const [sortOrder, setSortOrder] = useState('name'); 

  const fetchMedicines = useCallback(async () => {
    try {
      setLoading(true);
      const response = await inventoryService.getAllMedicines(currentPage, pageSize, sortOrder);
      const medicineData = response.data.results || response.data || [];
      setMedicines(medicineData);
      setTotalMedicines(response.data.count || medicineData.length || 0);
      setError(null);
    } catch {
      setError('Failed to fetch stock records ledger.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, sortOrder]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const handleFormChange = (e) => {
    setNewMed({ ...newMed, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      await inventoryService.createMedicine(newMed);
      setSuccessMessage(`Medicine item "${newMed.name}" added to inventory catalog.`);
      setIsAddModalOpen(false);
      setNewMed({ name: '', quantity: 0, price: 0.00 });
      fetchMedicines();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to populate medicine entry.');
    }
  };

  const handleEditClick = (med) => {
    setEditingMed({ ...med });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditFormError(null);
    try {
      await inventoryService.updateMedicine(editingMed.id, editingMed);
      setSuccessMessage(`Stock information updated for item: ${editingMed.name}`);
      setIsEditModalOpen(false);
      fetchMedicines();
    } catch (err) {
      setEditFormError(err.response?.data?.detail || 'Failed to save changes.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    try {
      await inventoryService.deleteMedicine(deleteConfirmation.id);
      setSuccessMessage('Inventory profile deleted from current registry.');
      setDeleteConfirmation(null);
      fetchMedicines();
    } catch {
      setError('De-provisioning failed.');
    }
  };

  const totalPages = Math.ceil(totalMedicines / pageSize);

  return (
    <div className="inventory-page">
      {/* Dynamic Header Section - Clears vertical Dead Space */}
      <div className="inventory-header-row">
        <h2>Stock Inventory Registry</h2>
        <Button onClick={() => setIsAddModalOpen(true)} variant="submit">
          + Add New Medicine
        </Button>
      </div>

      {successMessage && <p className="page-success">{successMessage}</p>}
      {error && <p className="page-error">{error}</p>}

      <div className="inventory-list-container">
        <table className="inventory-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Available Qty</th>
              <th>Unit Cost Price</th>
              <th>Status Alert</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              /* Shimmering Skeleton Loader Section */
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="skeleton-row">
                  <td><div className="skeleton-block skeleton-text" style={{ width: '180px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '50px' }}></div></td>
                  <td><div className="skeleton-block skeleton-text" style={{ width: '60px' }}></div></td>
                  <td><div className="skeleton-block skeleton-badge" style={{ width: '80px' }}></div></td>
                  <td><div className="skeleton-block skeleton-btn" style={{ width: '130px' }}></div></td>
                </tr>
              ))
            ) : medicines.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No medicines found in active catalog stock.</td>
              </tr>
            ) : (
              medicines.map((med) => {
                const isLowStock = med.quantity <= 10;
                return (
                  <tr key={med.id}>
                    <td><strong>{med.name}</strong></td>
                    <td>{med.quantity} units</td>
                    <td>${Number(med.price).toFixed(2)}</td>
                    <td>
                      <span className={`stock-status-badge ${isLowStock ? 'low-stock-alert' : 'healthy-stock-alert'}`}>
                        {isLowStock ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="edit" onClick={() => handleEditClick(med)} style={{ padding: '4px 8px', fontSize: '0.85rem' }}>
                          Update Stock
                        </Button>
                        <Button variant="delete" onClick={() => setDeleteConfirmation(med)} style={{ padding: '4px 8px', fontSize: '0.85rem' }}>
                          Delete
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

      {/* Delete Overlay Modal */}
      {deleteConfirmation && (
        <Modal onClose={() => setDeleteConfirmation(null)}>
          <div style={{ padding: '10px' }}>
            <h3>Remove Stock Item Listing</h3>
            <p style={{ margin: '15px 0' }}>
              Are you sure you want to permanently delete the profile for <strong>{deleteConfirmation.name}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button onClick={confirmDelete} variant="delete">Yes, Delete</Button>
              <Button onClick={() => setDeleteConfirmation(null)} variant="edit">Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Medicine Overlay Modal */}
      {isAddModalOpen && (
        <Modal onClose={() => setIsAddModalOpen(false)}>
          <div className="add-medicine-form-modal"> 
            <h3>Add New Medicine to Stock</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group span-two">
                <label>Medicine / Item Generic Name</label>
                <input type="text" name="name" value={newMed.name} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Initial Quantity</label>
                <input type="number" name="quantity" min="0" value={newMed.quantity} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Unit Price ($)</label>
                <input type="number" name="price" step="0.01" min="0" value={newMed.price} onChange={handleFormChange} required />
              </div>
              
              {formError && <p className="form-error span-two">{formError}</p>}
              
              <Button type="submit" variant="submit" className="span-two" style={{ marginTop: '10px' }}>
                Add to Stock
              </Button>
            </form>
          </div>
        </Modal>
      )}

      {/* Edit Medicine Overlay Modal */}
      {isEditModalOpen && editingMed && (
        <Modal onClose={() => setIsEditModalOpen(false)}>
          <div className="add-medicine-form-modal"> 
            <h3>Modify Stock Levels</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group span-two">
                <label>Medicine / Item Generic Name</label>
                <input type="text" value={editingMed.name} onChange={e => setEditingMed({...editingMed, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Current Quantity</label>
                <input type="number" min="0" value={editingMed.quantity} onChange={e => setEditingMed({...editingMed, quantity: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Unit Price ($)</label>
                <input type="number" step="0.01" min="0" value={editingMed.price} onChange={e => setEditingMed({...editingMed, price: e.target.value})} required />
              </div>
              
              {editFormError && <p className="form-error span-two">{editFormError}</p>}
              
              <Button type="submit" variant="submit" className="span-two" style={{ marginTop: '10px' }}>
                Save Changes
              </Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Inventory;