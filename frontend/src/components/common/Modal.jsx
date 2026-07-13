// src/components/common/Modal.jsx
import React from 'react';
import Button from './Button'; 
import './Modal.css'; 

function Modal({ children, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <Button onClick={onClose} className="modal-close-btn">
          &times;
        </Button>
        {children}
      </div>
    </div>
  );
}

export default Modal;