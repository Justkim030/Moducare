// src/pages/EditProfile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { userService } from '../api/userService';
import { useNavigate } from 'react-router-dom';
import './EditProfile.css';
import '../App.css';

function EditProfile() {
  const { user, setUser } = useAuth(); 
  const navigate = useNavigate();
  
  // Helper to access nested name safely
  const getName = (field) => user?.user?.name?.[field] || '';

  const [formData, setFormData] = useState({
    first_name: getName('first_name'),
    second_name: getName('second_name'),
    age: getName('age'),
    gender: getName('gender') || 'Male',
  });

  // New State for Image Handling
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Update state if user object loads late
  useEffect(() => {
    if (user) {
      setFormData({
        first_name: getName('first_name'),
        second_name: getName('second_name'),
        age: getName('age'),
        gender: getName('gender'),
      });

      // Set initial preview from existing profile picture
      const currentPic = user.profile_picture || user.employee?.profile_picture;
      if (currentPic) {
        setPreviewUrl(currentPic.startsWith('http') ? currentPic : `http://127.0.0.1:8000${currentPic}`);
      }
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle Image Selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Create a temporary URL to preview the image immediately
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // We use FormData because we are sending a File
    const dataPayload = new FormData();
    let hasChanges = false;

    // 1. Append Image if selected
    if (selectedFile) {
      dataPayload.append('profile_picture', selectedFile);
      hasChanges = true;
    }

    // 2. Check text changes
    const currentName = user?.user?.name || {};

    // Note: Sending nested data via FormData in Django usually requires dot notation
    // or a specific backend parser. We try standard dot notation here.
    if (formData.first_name !== currentName.first_name) {
      dataPayload.append('user.name.first_name', formData.first_name);
      hasChanges = true;
    }
    if (formData.second_name !== currentName.second_name) {
      dataPayload.append('user.name.second_name', formData.second_name);
      hasChanges = true;
    }
    if (parseInt(formData.age) !== currentName.age) {
        const ageVal = formData.age ? parseInt(formData.age) : '';
        dataPayload.append('user.name.age', ageVal);
        hasChanges = true;
    }
    if (formData.gender !== currentName.gender) {
      dataPayload.append('user.name.gender', formData.gender);
      hasChanges = true;
    }

    if (!hasChanges) {
      setError("No changes were made.");
      return;
    }

    try {
      // IMPORTANT: When sending FormData, axios automatically sets 'Content-Type': 'multipart/form-data'
      const response = await userService.updateUser(user.id, dataPayload);
      
      // Update local context
      setUser(response.data);
      
      setSuccess('Profile updated successfully! Redirecting...');
      setTimeout(() => navigate('/'), 2000);

    } catch (err) {
      console.error(err);
      // Improve error message if the backend complains about specific fields
      const msg = err.response?.data?.detail || 'Failed to update profile. Ensure all fields are valid.';
      setError(msg);
    }
  };

  if (!user) return <div>Loading profile...</div>;

  return (
    <div className="edit-profile-page">
      <h2>Edit Your Profile</h2>
      <p>Update your personal information and profile picture.</p>

      <form onSubmit={handleSubmit} className="edit-profile-form">
        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        {/* --- PROFILE PICTURE SECTION --- */}
        <div className="profile-pic-section">
            <div className="profile-pic-wrapper">
                {previewUrl ? (
                    <img src={previewUrl} alt="Profile Preview" className="profile-pic-preview" />
                ) : (
                    <div className="profile-pic-placeholder">
                        {user.user?.username?.charAt(0).toUpperCase()}
                    </div>
                )}
                <label htmlFor="profile_picture" className="camera-icon-btn">
                    📷
                </label>
                <input 
                    type="file" 
                    id="profile_picture" 
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }} // Hide the ugly default input
                />
            </div>
            <small className="text-muted">Click camera icon to change</small>
        </div>

        {/* Read-only Fields */}
        <div className="form-group">
          <label>Username</label>
          <input type="text" value={user.user?.username || ''} disabled className="input-disabled" />
        </div>
        
        <hr className="form-divider" />

        {/* Editable Fields */}
        <div className="form-row">
            <div className="form-group half">
            <label htmlFor="first_name">First Name</label>
            <input 
                type="text" 
                id="first_name"
                name="first_name" 
                value={formData.first_name} 
                onChange={handleChange} 
            />
            </div>
            <div className="form-group half">
            <label htmlFor="second_name">Second Name</label>
            <input 
                type="text" 
                id="second_name"
                name="second_name" 
                value={formData.second_name} 
                onChange={handleChange} 
            />
            </div>
        </div>

        <div className="form-row">
            <div className="form-group half">
            <label htmlFor="age">Age</label>
            <input 
                type="number" 
                id="age"
                name="age" 
                value={formData.age} 
                onChange={handleChange} 
            />
            </div>
            <div className="form-group half">
            <label htmlFor="gender">Gender</label>
            <select 
                id="gender"
                name="gender" 
                value={formData.gender} 
                onChange={handleChange}
            >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
            </select>
            </div>
        </div>

        <button type="submit" className="submit-btn">Save Changes</button>
      </form>
    </div>
  );
}

export default EditProfile;