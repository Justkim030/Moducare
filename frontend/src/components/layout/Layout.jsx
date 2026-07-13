// src/components/layout/Layout.jsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import './Layout.css'; 

const Layout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`layout-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Navbar />
      <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
      <main className="main-content">
        <div className="page-content">
          <Outlet /> 
        </div>
      </main>
    </div>
  );
};

export default Layout;