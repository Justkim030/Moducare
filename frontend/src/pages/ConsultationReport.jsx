// src/pages/ConsultationReport.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { visitService } from '../api/visitService';
import { labService } from '../api/labService'; 
import Button from '../components/common/Button'; 
import './ConsultationReport.css'; 
import '../App.css';

function ConsultationReport() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const [visit, setVisit] = useState(null);
  
  // Form Data
  const [notes, setNotes] = useState('');
  const [complaint, setComplaint] = useState(''); 
  const [pharmacyNotes, setPharmacyNotes] = useState(''); 
  
  // Lab Data
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]); 

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const visitRes = await visitService.getVisitById(visitId);
      const visitData = visitRes.data;
      
      setVisit(visitData);
      
      // FIX: Access nested triage data
      setNotes(visitData.consultation_notes || ''); 
      setComplaint(visitData.triage?.chief_complaint || ''); // Access from triage object
      
      const labRes = await labService.getAvailableTests();
      setAvailableTests(labRes.data.results || labRes.data || []);
      
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch consultation data.');
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, [visitId]);

  const handleTestSelection = (e) => {
    const testId = parseInt(e.target.value, 10);
    if (e.target.checked) {
        setSelectedTests([...selectedTests, testId]);
    } else {
        setSelectedTests(selectedTests.filter(id => id !== testId));
    }
  };
  const handleSaveAndPrescribe = async () => {
    try {
      setLoading(true);
      // Use saveConsultationReport as defined in your service
      await visitService.saveConsultationReport(visitId, {
        consultation_notes: notes,
        triage: {
          chief_complaint: complaint
        },
        status: 'COMPLETE' 
      });

      if (selectedTests.length > 0) {
         await labService.createLabOrders({
             visit: visitId,
             tests: selectedTests
         });
      }

      navigate(`/prescriptions?visitId=${visitId}&notes=${encodeURIComponent(pharmacyNotes)}`);
    } catch (err) {
      console.error("API Update Error:", err.response?.data || err);
      setError(`Failed to finalize: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };
  // Modern Shimmering Skeleton Loader Screen Layout (Prevents Layout Jumps & Dead Space)
  if (loading && !visit) {
    return (
      <div className="consultation-report-page skeleton-loading">
        <div className="skeleton-banner">
          <div className="skeleton-line head" style={{ width: '40%' }}></div>
          <div className="skeleton-line sub" style={{ width: '70%' }}></div>
        </div>
        <div className="skeleton-section">
          <div className="skeleton-line title" style={{ width: '20%' }}></div>
          <div className="skeleton-box field-small"></div>
        </div>
        <div className="skeleton-section">
          <div className="skeleton-line title" style={{ width: '30%' }}></div>
          <div className="skeleton-box field-large"></div>
        </div>
        <div className="skeleton-section">
          <div className="skeleton-line title" style={{ width: '25%' }}></div>
          <div className="skeleton-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-card"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) return <p className="page-error">{error}</p>;

  return (
    <div className="consultation-report-page">
      <h2>Doctor Consultation Window</h2>
      
      {visit && (
        <div className="report-patient-header">
          <h3>Patient: {visit?.patient_name}</h3>
          <div className="vitals-sub-bar">
            <span><strong>BP:{visit?.triage?.bp_systolic || '--'}/{visit?.triage?.bp_diastolic || '--'}</strong></span>
            <span><strong>Temp: {visit?.triage?.body_temp}</strong></span>
            <span><strong>Weight: {visit?.triage?.weight ? `${visit?.triage?.weight}kg` : 'N/A'}</strong> </span>
            <span><strong>Heart Rate: {visit?.triage?.heart_rate || '--'}</strong></span>
          </div>
        </div>
      )}

      <div className="consultation-split-grid">
        <div className="report-section">
          <h3>1. Chief Complaint</h3>
          <input 
            className="report-input-field"
            value={complaint} 
            onChange={(e) => setComplaint(e.target.value)} 
            placeholder="What is bringing the patient in today?"
          />
        </div>

        <div className="report-section">
          <h3>2. Detailed Clinical Assessment & Diagnosis Notes</h3>
          <textarea 
            className="report-textarea" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            placeholder="Enter physical examination results, system reviews, assessment benchmarks, and differential diagnosis..."
          />
        </div>

        {/* --- Lab Ordering --- */}
        <div className="report-section">
          <h3>3. Order Lab Tests (Optional)</h3>
          <div className="lab-test-grid">
              {availableTests.length === 0 && <p className="text-muted">No lab tests available in catalog.</p>}
              {availableTests.map(test => (
                  <label key={test.id} className="lab-checkbox-label">
                      <input 
                          type="checkbox" 
                          value={test.id} 
                          checked={selectedTests.includes(test.id)}
                          onChange={handleTestSelection}
                      />
                      <span className="test-name-tag">{test.name}</span>
                      <span className="test-price-tag">${test.price}</span>
                  </label>
              ))}
          </div>
        </div>
        
        <div className="report-section">
          <h3>4. Pharmacy Notes</h3>
          <textarea 
            className="report-textarea pharmacy-notes" 
            value={pharmacyNotes} 
            onChange={(e) => setPharmacyNotes(e.target.value)} 
            placeholder="Enter specific instructions or dosage requests for the pharmacist..."
          />
        </div>
      </div>

      <div className="consultation-footer-actions">
        <Button onClick={handleSaveAndPrescribe} variant="submit">
          Save & Proceed to Pharmacy &rarr;
        </Button>
      </div>
    </div>
  );
}

export default ConsultationReport;