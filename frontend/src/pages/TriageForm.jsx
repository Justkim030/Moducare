// src/pages/TriageForm.jsx
import React, { useState, useEffect } from 'react';
import { patientService } from '../api/patientService';
import { visitService } from '../api/visitService';
import { useParams, useNavigate } from 'react-router-dom';
import './Triage.css'; 
import '../App.css';

function TriageForm() {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [triageData, setTriageData] = useState({
    triage_level: 'LEVEL_5',
    patient_type: 'OPD',
    ward: '',
    bed_number: '',
    body_temp_celsius: '',
    weight_kg: '',
    bp_systolic: '',
    bp_diastolic: '',
    heart_rate: ''
  });

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        setLoading(true);
        const res = await patientService.getPatientById(patientId);
        setPatient(res.data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch patient data.');
      } finally {
        setLoading(false);
      }
    };
    fetchPatient();
  }, [patientId]);

  const handleTriageDataChange = (e) => {
    const { name, value } = e.target;
    setTriageData(prev => ({ ...prev, [name]: value }));
  };

  const handleTriageSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      // Construct the payload to match the Django Nested Serializer
      const visitData = {
        patient: patientId,
        status: "PENDING", 
        
        patient_type: triageData.patient_type,
        ward: triageData.patient_type === 'IPD' ? triageData.ward : null,
        bed_number: triageData.patient_type === 'IPD' ? triageData.bed_number : null,

        triage: {
          chief_complaint: "To be assessed by Doctor", 
          triage_level: triageData.triage_level,
          body_temp: triageData.body_temp_celsius || null, 
          weight: triageData.weight_kg || null,
          bp_systolic: triageData.bp_systolic || null,
          bp_diastolic: triageData.bp_diastolic || null,
          heart_rate: triageData.heart_rate || null,
        }
      };

      console.log("Sending Payload:", visitData); 
      
      await visitService.createVisit(visitData);
      navigate('/triage-queue');

    } catch (err) {
      console.error("API Error:", err.response ? err.response.data : err);
      // improved error handling to show exactly what field failed
      const serverMsg = err.response?.data 
        ? JSON.stringify(err.response.data) 
        : 'Failed to create visit.';
      setError(serverMsg);
    }
  };

  if (loading) return <div className="triage-page-container"><h2>Loading patient data...</h2></div>;
  if (error) return <div className="triage-page-container"><p className="page-error">{error}</p></div>;
  if (!patient) return <div className="triage-page-container"><p className="page-error">Patient not found.</p></div>;

  return (
    
    <div className="triage-page-container">
      <div className="triage-form-container">
        <h2>Triage Assessment for: <strong>{patient.full_name}</strong></h2>
        
        <form onSubmit={handleTriageSubmit}>
          
          <div className="form-section">
            <h3>Priority Assessment</h3>
            <div className="form-group">
              <label>Triage Priority Level*</label>
              <select name="triage_level" value={triageData.triage_level} onChange={handleTriageDataChange} required>
                <option value="LEVEL_5">Level 5 (Non-Urgent) - Simple injury/illness</option>
                <option value="LEVEL_4">Level 4 (Less Urgent) - Needs examination/tests</option>
                <option value="LEVEL_3">Level 3 (Urgent) - Requires two or more resources</option>
                <option value="LEVEL_2">Level 2 (Emergency) - High-risk, vital signs compromised</option>
                <option value="LEVEL_1">Level 1 (Resuscitation) - Immediate life threat</option>
              </select>
            </div>
          </div>
          
          <div className="form-section">
            <h3>Vitals Entry</h3>
            <div className="vitals-grid">
              <div className="form-group">
                <label>Body Temp (°C)</label>
                <input type="number" step="0.1" name="body_temp_celsius" placeholder="e.g., 37.0" value={triageData.body_temp_celsius} onChange={handleTriageDataChange} />
              </div>
              <div className="form-group">
                <label>Weight (kg)</label>
                <input type="number" step="0.1" name="weight_kg" placeholder="e.g., 75.5" value={triageData.weight_kg} onChange={handleTriageDataChange} />
              </div>
              <div className="form-group">
                <label>Heart Rate (bpm)</label>
                <input type="number" name="heart_rate" placeholder="e.g., 85" value={triageData.heart_rate} onChange={handleTriageDataChange} />
              </div>
              <div className="form-group">
                <label>Blood Pressure (mmHg)</label>
                <div className="bp-group">
                  <input type="number" name="bp_systolic" placeholder="Systolic" value={triageData.bp_systolic} onChange={handleTriageDataChange} />
                  <span>/</span>
                  <input type="number" name="bp_diastolic" placeholder="Diastolic" value={triageData.bp_diastolic} onChange={handleTriageDataChange} />
                </div>
              </div>
            </div>
          </div>
          <div className="form-section">
            <h3>Admission Status</h3>
            <div className="form-group">
              <label>Patient Type</label>
              <select name="patient_type" value={triageData.patient_type} onChange={handleTriageDataChange}>
                <option value="OPD">Out-Patient (Goes home today)</option>
                <option value="IPD">In-Patient (Admit to Ward)</option>
              </select>
            </div>

            {/* Only show Ward info if In-Patient is selected */}
            {triageData.patient_type === 'IPD' && (
              <div className="form-row">
                  <div className="form-group half">
                      <label>Ward Name</label>
                      <input type="text" name="ward" placeholder="e.g. Maternity" value={triageData.ward} onChange={handleTriageDataChange} />
                  </div>
                  <div className="form-group half">
                      <label>Bed Number</label>
                      <input type="text" name="bed_number" placeholder="e.g. 104-A" value={triageData.bed_number} onChange={handleTriageDataChange} />
                  </div>
              </div>
            )}
          </div>
        
          {error && <p className="page-error">{error}</p>}
          <button type="submit" className="submit-btn">Add Patient to Doctor's Queue</button>
        </form>
      </div>
    </div>
  );
}

export default TriageForm;