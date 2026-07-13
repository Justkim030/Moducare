import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Sidebar.css'; 

function Sidebar({ isCollapsed, toggleSidebar }) {
  const { user,  } = useAuth();

  // Access nested 'user' object for role safely
  const role = user?.user?.employee_type;

  // Safety Check
  if (!role) return null;

  return (
    <nav className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
         <button onClick={toggleSidebar} className="sidebar-toggle-btn" title="Toggle Sidebar">
            <span className="material-icons">
              {isCollapsed ? 'chevron_right' : 'chevron_left'}
            </span>
         </button>
      </div>

      <ul className="sidebar-nav">
        <li>
          <NavLink to="/" title="Dashboard">
            <span className="material-icons icon">dashboard</span>
            {!isCollapsed && <span className="label">Dashboard</span>}
          </NavLink>
        </li>

        {/* --- DOCTOR --- */}
        {role === 'DOCTOR' && (
          <>
            <li>
              <NavLink to="/triage-queue" title="Patient Queue">
                <span className="material-icons icon">groups</span>
                {!isCollapsed && <span className="label">Patient Queue</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/ward" title="In-Patient Ward">
                 <span className="material-icons icon">hotel</span>
                 {!isCollapsed && <span className="label">In-Patient Ward</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/prescriptions" end title="My Prescriptions">
                 <span className="material-icons icon">description</span>
                 {!isCollapsed && <span className="label">My Prescriptions</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/reports" title="View Reports">
                 <span className="material-icons icon">assessment</span>
                 {!isCollapsed && <span className="label">View Reports</span>}
              </NavLink>
            </li>
          </>
        )}

        {/* --- PHARMACIST --- */}
        {role === 'CHEMIST' && (
          <li>
            <NavLink to="/dispense" title="Dispense">
              <span className="material-icons icon">medication</span>
              {!isCollapsed && <span className="label">Dispense</span>}
            </NavLink>
          </li>
        )}

        {/* --- RECEPTIONIST --- */}
        {role === 'RECEPTIONIST' && (
          <li>
            <NavLink to="/register" title="Registration">
              <span className="material-icons icon">how_to_reg</span>
              {!isCollapsed && <span className="label">Registration</span>}
            </NavLink>
          </li>
        )}

        {/* --- NURSING TEAM (Triage & General Nurse) --- */}
        {(role === 'TRIAGE' || role === 'NURSE') && (
          <>
            <li>
              <NavLink to="/register" title="Registration">
                <span className="material-icons icon">how_to_reg</span>
                {!isCollapsed && <span className="label">Registration</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/triage-queue" title="Triage Queue">
                 <span className="material-icons icon">queue</span>
                 {!isCollapsed && <span className="label">Triage Queue</span>}
              </NavLink>
            </li>
            
            {role === 'NURSE' && (
              <li>
                <NavLink to="/ward" title="In-Patient Ward">
                   <span className="material-icons icon">hotel</span>
                   {!isCollapsed && <span className="label">In-Patient Ward</span>}
                </NavLink>
              </li>
            )}
          </>
        )}

        {/* --- ACCOUNTANT --- */}
        {role === 'ACCOUNTANT' && (
          <li>
            <NavLink to="/accounts" title="Accounts & Billing">
               <span className="material-icons icon">account_balance_wallet</span>
               {!isCollapsed && <span className="label">Billing</span>}
            </NavLink>
          </li>
        )}

        {/* --- LAB TECH --- */}
        {role === 'LAB_TECH' && (
          <li>
            <NavLink to="/lab" title="Laboratory">
               <span className="material-icons icon">biotech</span>
               {!isCollapsed && <span className="label">Laboratory</span>}
            </NavLink>
          </li>
        )}
        
        {/* --- ADMIN --- */}
        {role === 'ADMIN' && (
          <>
            <li>
              <NavLink to="/staff" title="Staff Management">
                <span className="material-icons icon">badge</span>
                {!isCollapsed && <span className="label">Staff Management</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/patients" title="Patient Records">
                <span className="material-icons icon">assignment_ind</span>
                {!isCollapsed && <span className="label">Patient Records</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/ward" title="In-Patient Ward">
                 <span className="material-icons icon">hotel</span>
                 {!isCollapsed && <span className="label">Ward Management</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/inventory" title="Inventory">
                 <span className="material-icons icon">inventory_2</span>
                 {!isCollapsed && <span className="label">Inventory</span>}
              </NavLink>
            </li>
            <li>
              <NavLink to="/accounts" title="Accounts">
                 <span className="material-icons icon">account_balance_wallet</span>
                 {!isCollapsed && <span className="label">Billing</span>}
              </NavLink>
            </li>
          </>
        )}
        
        {/* --- STORE MANAGER --- */}
        {role === 'STORE_MANAGER' && (
          <>
            <li>
              <NavLink to="/inventory" title="Inventory">
                 <span className="material-icons icon">inventory_2</span>
                 {!isCollapsed && <span className="label">Inventory</span>}
              </NavLink>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

export default Sidebar;