// src/components/common/Button.jsx
import React from 'react';

function Button({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'submit', // Options: 'submit', 'edit', 'delete'
  className = '', 
  style,
  disabled,
  ...props 
}) {
  // Dynamically maps base variants and active state triggers
  const baseClass = [
    `${variant}-btn`,
    disabled ? 'btn-disabled' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button 
      type={type} 
      onClick={onClick} 
      className={baseClass} 
      style={style}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;