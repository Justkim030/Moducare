// src/pages/Settings.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom'; // <-- 1. Import useNavigate
import './Settings.css';
import '../App.css';
import { useTheme } from '../context/ThemeContext';

function Settings() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate(); // <-- 2. Initialize it

  const toggleProfile = () => {
    navigate('/profile'); 
  };

  return (
    <div className="settings-page">
      <h2>Application Settings</h2>
      
      <div className="settings-card">
        <h3>Update Profile</h3>
        <button onClick={toggleProfile}>Update Profile</button>
      </div>
      
      <div className="settings-card">
        <h3>Other Settings</h3>
        <p>Additional settings will be available here in future updates.</p>
      </div>
      
      <div className="settings-card">
        <h3>Theme</h3>
        <p>You can change the theme (light/dark mode) using the ☀️/🌙 icon in the top navigation bar.</p>
        <button onClick={toggleTheme} className="theme-toggle-btn" title="Toggle Theme">
            {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
      
    </div>
  );
}

export default Settings;