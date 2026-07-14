// src/components/layout/Navbar.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Navbar.css';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const dropdownRef = useRef(null);

// Inside your Navbar function in Navbar.jsx



  const searchHints = [
    "Search for data, or files...",
    "Try searching for records...",
    "Search assets or clients...",
    "Press '/' to focus search..."
  ];

  useEffect(() => {
    if (isFocused || searchQuery) return;

    const interval = setInterval(() => {
      setPlaceholderIndex((prevIndex) => (prevIndex + 1) % searchHints.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isFocused, searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== document.querySelector('.navbar-search-input')) {
        e.preventDefault();
        document.querySelector('.navbar-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getUserRole = () => user?.employee_type || user?.user?.employee_type || '';
  const getUsername = () => user?.username || user?.user?.username || 'User';
  
  const getProfilePic = () => {
    if (user?.profile_picture) return user.profile_picture;
    if (user?.employee?.profile_picture) return user.employee.profile_picture;
    if (user?.user?.profile_picture) return user.user.profile_picture;
    return null;
  };

  const role = getUserRole();
  const username = getUsername();
  const profilePicUrl = getProfilePic();
  // Update your allLinks array
  const allLinks = [
    { name: 'Dashboard', path: '/' },
    { name: 'Patients Registry', path: '/patients' },
    { name: 'Triage Center', path: '/triage' },
    { name: 'Consultations', path: '/consultation' },
    { name: 'Laboratory', path: '/laboratory' },
    { name: 'Pharmacy', path: '/pharmacy' },
    // Define allowed roles for Inventory
    { name: 'Inventory Management', path: '/inventory', allowedRoles: ['ADMIN', 'STORE_MANAGER'] },
    { name: 'Billing Records', path: '/billing' },
    // Define allowed roles for Staff
    { name: 'Staff Management', path: '/staff', allowedRoles: ['ADMIN'] },
    { name: 'Account Settings', path: '/settings' },
    { name: 'Edit Profile', path: '/profile' }
  ];

  const navLinks = allLinks.filter(link => {
    // If the link has specific allowed roles, check if current role is included
    if (link.allowedRoles) {
      return link.allowedRoles.includes(role);
    }
    // Otherwise, it's visible to everyone
    return true;
  });
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  const closeDropdown = () => setIsDropdownOpen(false);

  const handleSearchSubmit = (e) => {
      e.preventDefault();
      const match = navLinks.find(link => 
        link.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (match) {
        navigate(match.path);
        setSearchQuery('');
        setIsFocused(false);
      }
    };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/"> Moducare </Link>
      </div>

      <form onSubmit={handleSearchSubmit} className="navbar-search-container">
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)} // Short delay to let clicks process cleanly
          placeholder={isFocused ? "Type to search..." : searchHints[placeholderIndex]} 
          className="navbar-search-input" 
        />
        
        {isFocused && searchQuery && (
          <ul className="search-results-dropdown">
            {navLinks.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())).map(link => (
              <li key={link.path} onClick={() => { navigate(link.path); setSearchQuery(''); }}>
                {link.name}
              </li>
            ))}
          </ul>
        )}
        <button 
          type="submit" 
          className="search-icon-btn"
          aria-label="Submit Search"
          title="Click to search"
        >
          <span className="material-symbols-outlined">search</span>
        </button>
      </form>

      <ul className="navbar-links">
        <li>
          
        </li>

        <li ref={dropdownRef} className="navbar-profile">
          <button onClick={toggleDropdown} className="profile-trigger" title={username}>
            {profilePicUrl ? (
              <img 
                src={profilePicUrl.startsWith('http') ? profilePicUrl : `http://127.0.0.1:8000${profilePicUrl}`} 
                alt="Profile" 
                className="navbar-profile-img" 
              />
            ) : (
              <div className="placeholder-avatar">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
          {isDropdownOpen && (
            <ul className="profile-dropdown">
              <li className="dropdown-header">
                <strong>{username || "Guest"}</strong>
                <small>{role.replace('_', ' ')}</small>
              </li>
              <li><Link to="/settings" onClick={closeDropdown}>Settings</Link></li>
              <li className="dropdown-divider"></li>
              <li>
                <button onClick={handleLogout} className="dropdown-logout-button">Logout</button>
              </li>
            </ul>
          )}
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;