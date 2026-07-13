// src/pages/Dispense.jsx
import React, { useState, useEffect } from 'react';
import { prescriptionService } from '../api/prescriptionService';
import { inventoryService } from '../api/inventoryService'; 
import Modal from '../components/common/Modal';
import './Dispense.css';
import '../App.css';

function Dispense() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [medicines, setMedicines] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [ setError] = useState(null);

  // ... (modal state) ...
  const [fillModalOpen, setFillModalOpen] = useState(false);
  const [fillingPrescription, setFillingPrescription] = useState(null);
  const [medicineQuery, setMedicineQuery] = useState('');
  const [medicineSuggestions, setMedicineSuggestions] = useState([]);
  const [currentItem, setCurrentItem] = useState({ medicine: '', quantity: 1, notes: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [presRes, medRes] = await Promise.all([
        prescriptionService.getAllPrescriptions(),
        inventoryService.getAllMedicines()
      ]);
      
      setPrescriptions(presRes.data.results || presRes.data);
      setMedicines(medRes.data.results || medRes.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch data.',err);
    } finally {
      setLoading(false);
    }
  };

  // ... (handle functions remain the same) ...
  const handleOpenFillModal = (prescription) => {
    setFillingPrescription(prescription);
    setFillModalOpen(true);
    setMedicineQuery('');
    setMedicineSuggestions([]);
    setCurrentItem({ medicine: '', quantity: 1, notes: '' });
  };

  const handleMedicineChange = (e) => {
    const query = e.target.value;
    setMedicineQuery(query);
    if (!query) {
      setMedicineSuggestions([]);
      setCurrentItem(p => ({...p, medicine: ''}));
    } else {
      const suggestions = medicines.filter(m => 
        m.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10);
      setMedicineSuggestions(suggestions);
    }
  };

  const handleSuggestionClick = (med) => {
    setMedicineQuery(med.name);
    setCurrentItem(p => ({...p, medicine: med.id}));
    setMedicineSuggestions([]);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!currentItem.medicine || currentItem.quantity <= 0) return;

    try {
      await prescriptionService.addPrescriptionItem({
        prescription: fillingPrescription.id,
        medicine: currentItem.medicine,
        quantity: currentItem.quantity,
        notes: currentItem.notes
      });
      await fetchData();
      setCurrentItem({ medicine: '', quantity: 1, notes: '' });
      setMedicineQuery('');
      setFillModalOpen(false); 
    } catch (err) {
      alert('Failed to add medicine.',err);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Remove this item from the prescription?")) return;
    try {
      await prescriptionService.deletePrescriptionItem(itemId);
      fetchData();
    } catch (err) {
      alert("Failed to delete item.", err);
    }
  };

  const handleEditItem = async (item) => {
    const newQty = prompt(`Enter new quantity for ${item.medicine_name}:`, item.quantity);
    if (newQty === null) return;

    try {
      await prescriptionService.updatePrescriptionItem(item.id, {
        quantity: parseInt(newQty)
      });
      fetchData();
    } catch (err) {
      alert("Failed to update item.",err);
    }
  };

  const handleMarkAsPaid = async (id) => {
    try {
      const response = await prescriptionService.markAsPaid(id);
      setPrescriptions(prev => prev.map(p => (p.id === id ? response.data : p)));
    } catch (err) {
      alert('Failed.',err);
    }
  };

  const handleDispense = async (id) => {
    if (window.confirm('Confirm dispense?')) {
      try {
        const response = await prescriptionService.dispensePrescription(id);
        setPrescriptions(prev => prev.map(p => (p.id === id ? response.data : p)));
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to dispense.');
      }
    }
  };

  const renderPrescriptionTable = (prescription) => (
    <>
      {prescription.visit_pharmacy_notes && (
        <div className="pharmacy-note-box">
          <strong>Note from Doctor:</strong> {prescription.visit_pharmacy_notes}
        </div>
      )}
      
      <table className="prescription-items-table">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Req. Qty</th>
            <th>Available</th>
            <th>Dosage</th>
            <th>Price</th>
            {prescription.status === 'PENDING' && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {prescription.items.length === 0 ? (
            <tr><td colSpan="6" style={{textAlign:'center'}}>No medicines added yet.</td></tr>
          ) : (
            prescription.items.map((item, index) => {
              const isInsufficient = item.quantity > item.medicine_stock;
              return (
                <tr key={index} style={isInsufficient ? {backgroundColor: 'var(--danger)', color: 'white'} : {}}>
                  <td>{item.medicine_name}</td>
                  <td>{item.quantity}</td>
                  <td>
                     {item.medicine_stock}
                     {isInsufficient && <strong> (Low!)</strong>}
                  </td>
                  <td>{item.notes || '-'}</td>
                  <td>${parseFloat(item.medicine_price).toFixed(2)}</td>
                  {prescription.status === 'PENDING' && (
                    <td style={{ display: 'flex', gap: '5px' }}>
                       <button 
                         onClick={() => handleEditItem(item)} 
                         className="edit-btn"
                         style={{fontSize:'0.8rem', padding:'2px 8px'}}
                       >
                         Edit
                       </button>
                       <button 
                         onClick={() => handleDeleteItem(item.id)} 
                         className="delete-btn"
                         style={{fontSize:'0.8rem', padding:'2px 8px'}}
                       >
                         X
                       </button>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </>
  );

  if (loading && prescriptions.length === 0) return <h2>Loading...</h2>;
  
  const pendingPayment = prescriptions.filter(p => p.status === 'PENDING');
  const pendingDispense = prescriptions.filter(p => p.status === 'PAID');
  const dispensed = prescriptions.filter(p => p.status === 'DISPENSED');

  return (
    <div className="dispense-page">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2>⚕️ Dispense Prescriptions</h2>
        <button onClick={fetchData} className="dispense-btn" style={{width: 'auto'}}>
            ↻ Refresh
        </button>
      </div>
      
      <div className="list-section">
        <h3>1. Pending (Fill & Pay)</h3>
        {pendingPayment.length === 0 && <p>No pending prescriptions.</p>}
        {pendingPayment.map(p => (
            <div key={p.id} className="prescription-card">
              <div className="card-header">
                <strong>Prescription #{p.id}</strong>
                <div>
                    <button onClick={() => handleOpenFillModal(p)} className="edit-btn" style={{marginRight:'10px'}}>
                        + Add Meds
                    </button>
                    <button onClick={() => handleMarkAsPaid(p.id)} className="mark-paid-btn">
                        Mark Paid
                    </button>
                </div>
              </div>
              <div className="card-body">
                <p><strong>Patient:</strong> {p.patient_name}</p>
                <p><strong>Doctor:</strong> {p.doctor_name}</p>
                {renderPrescriptionTable(p)}
              </div>
            </div>
        ))}
      </div>

      <div className="list-section">
        <h3>2. Ready to Dispense (Paid)</h3>
        {pendingDispense.length === 0 && <p>No paid prescriptions ready.</p>}
        {pendingDispense.map(p => (
            <div key={p.id} className="prescription-card paid">
              <div className="card-header">
                <strong>Prescription #{p.id}</strong>
                <button onClick={() => handleDispense(p.id)} className="dispense-btn">Mark as Dispensed</button>
              </div>
              <div className="card-body">
                <p><strong>Patient:</strong> {p.patient_name}</p>
                {renderPrescriptionTable(p)}
              </div>
            </div>
        ))}
      </div>

      <div className="list-section">
        <h3>3. Dispensed</h3>
        {dispensed.length === 0 && <p>No dispensed history.</p>}
        {dispensed.map(p => (
            <div key={p.id} className="prescription-card dispensed">
              <div className="card-header">
                <strong>Prescription #{p.id} (Dispensed)</strong>
              </div>
              <div className="card-body">
                <p><strong>Patient:</strong> {p.patient_name}</p>
                <p><strong>Dispensed By:</strong> {p.dispensed_by_name}</p>
                {renderPrescriptionTable(p)}
              </div>
            </div>
        ))}
      </div>

      {fillModalOpen && fillingPrescription && (
        <Modal onClose={() => setFillModalOpen(false)} title={`Add Medicines for ${fillingPrescription.patient_name}`}>
          <div className="fill-modal-content">
             <div className="pharmacy-note-box" style={{marginBottom: '20px'}}>
                <strong>Doctor's Order:</strong> {fillingPrescription.visit_pharmacy_notes || "No notes provided."}
             </div>

             <div className="add-item-form">
                <div className="form-group autocomplete-wrapper" style={{position: 'relative'}}>
                  <label>Medicine</label>
                  <input type="text" value={medicineQuery} onChange={handleMedicineChange} placeholder="Search..." />
                  {medicineSuggestions.length > 0 && (
                    <ul className="medicine-suggestions" style={{position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #ccc', zIndex:100}}>
                      {medicineSuggestions.map(m => (
                        <li key={m.id} onClick={() => handleSuggestionClick(m)} style={{padding:'10px', cursor:'pointer', borderBottom:'1px solid #eee'}}>
                          {m.name} ({m.quantity} in stock)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="form-group">
                  <label>Qty</label>
                  <input type="number" value={currentItem.quantity} onChange={e => setCurrentItem(p=>({...p, quantity: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label>Dosage</label>
                  <input type="text" value={currentItem.notes} onChange={e => setCurrentItem(p=>({...p, notes: e.target.value}))} />
                </div>
                <button onClick={handleAddItem} className="submit-btn" style={{marginTop:'24px'}}>Add Item</button>
             </div>
             
             <div style={{textAlign:'right', marginTop:'20px'}}>
                 <button onClick={() => setFillModalOpen(false)} className="delete-btn" style={{backgroundColor:'#666', border:'none', color:'white'}}>Close</button>
             </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

export default Dispense;