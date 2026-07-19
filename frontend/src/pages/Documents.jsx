// src/pages/Documents.jsx
import React, { useState, useEffect, useRef } from 'react';
import { documentsService } from '../api/documentsService';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import './Documents.css';

function Documents() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await documentsService.getDocuments();
      setItems(res.data.results || res.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load documents.',err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please choose a file.');
    const fd = new FormData();
    fd.append('title', title);
    fd.append('description', description);
    fd.append('file', file);
    try {
      await documentsService.uploadDocument(fd);
      setSuccess('Document uploaded.');
      setIsOpen(false);
      setTitle(''); setDescription(''); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : 'Failed to upload document.');
    }
  };

  const remove = async (id) => {
    try {
      await documentsService.deleteDocument(id);
      setSuccess('Document deleted.');
      load();
    } catch (err) {
      setError('Failed to delete document.',err);
    }
  };

  return (
    <div className="documents-page">
      <div className="staff-header-row">
        <h2>Document Vault</h2>
        <Button variant="submit" onClick={() => setIsOpen(true)}>+ Upload Document</Button>
      </div>
      {success && <p className="page-success">{success}</p>}
      {error && <p className="page-error">{error}</p>}

      {loading ? (
        <p className="hr-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="hr-muted">No documents uploaded.</p>
      ) : (
        <table className="hr-table">
          <thead>
            <tr><th>Title</th><th>Description</th><th>Uploaded By</th><th>Date</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td>{d.description || '—'}</td>
                <td>{d.uploaded_by ?? '—'}</td>
                <td>{d.uploaded_at ?? '—'}</td>
                <td>
                  <div className="action-button-group">
                    {d.file && <a className="mc-btn btn-sm btn-ghost" href={d.file} target="_blank" rel="noreferrer">Open</a>}
                    <Button variant="delete" onClick={() => remove(d.id)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isOpen && (
        <Modal onClose={() => setIsOpen(false)}>
          <div className="hr-form-modal">
            <h3>Upload Document</h3>
            <form onSubmit={submit}>
              <div className="form-group span-two"><label>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
              <div className="form-group span-two"><label>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="form-group span-two"><label>File</label>
                <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files[0])} required /></div>
              <Button type="submit" variant="submit" className="span-two">Upload</Button>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Documents;
