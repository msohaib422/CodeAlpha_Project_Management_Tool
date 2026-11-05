import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, Trash2, Search, X } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';
import Skeleton from '../components/Skeleton';
import API, { SERVER_ORIGIN } from '../services/api';
import Modal from '../components/Modal';
import { NotificationContext } from '../context/NotificationContext';
import { AuthContext } from '../context/AuthContext';

const getInitials = (name) => {
  if (!name) return 'U';
  return name.split(' ').map((i) => i[0]).join('').substring(0, 2).toUpperCase();
};

const UserManagement = () => {
  const { user: currentUser } = useContext(AuthContext);
  const { addToast } = useContext(NotificationContext);
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [highlightedUserId, setHighlightedUserId] = useState(null);

  const [form, setForm] = useState({
    name: '', email: '', username: '', password: '12345678',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!highlightId || users.length === 0) return;
    setSearch('');
    const el = document.getElementById(`user-row-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedUserId(highlightId);
      const timer = setTimeout(() => setHighlightedUserId(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [highlightId, users]);

  const fetchUsers = async () => {
    try {
      const { data } = await API.get('/users');
      setUsers(data);
    } catch (error) {
      addToast('Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      addToast('Name and email are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.username) delete payload.username;
      await API.post('/users', payload);
      addToast(`User created. Default password: ${form.password || '12345678'}`, 'success');
      setIsModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to create user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      await API.delete(`/users/${deleteTarget._id}`);
      addToast(`${deleteTarget.name} has been removed`, 'success');
      setDeleteTarget(null);
      fetchUsers();
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  const handleApprove = async (u) => {
    try {
      await API.put(`/users/${u._id}/approve`);
      addToast(`${u.name} approved`, 'success');
      fetchUsers();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to approve', 'error');
    }
  };

  const handleReject = async (u) => {
    try {
      await API.put(`/users/${u._id}/reject`);
      addToast(`${u.name} rejected`, 'success');
      fetchUsers();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to reject', 'error');
    }
  };

  const resetForm = () => {
    setForm({ name: '', email: '', username: '', password: '12345678' });
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{users.length} registered users in the system</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <UserPlus size={18} />
          <span>Add User</span>
        </button>
      </div>

      <div style={{ position: 'relative', maxWidth: '380px', marginBottom: '20px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="form-input"
          placeholder="Search by name, email or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '36px', paddingRight: search ? '36px' : '12px' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '16px' }}>
            {[1,2,3,4].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--card-border)' }}>
                <Skeleton width="38px" height="38px" radius="50%" />
                <div style={{ flex: 1 }}>
                  <Skeleton width="120px" height="16px" style={{ marginBottom: '6px' }} />
                  <Skeleton width="180px" height="12px" />
                </div>
                <Skeleton width="60px" height="24px" />
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Username', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isMe = u._id === currentUser._id;
                return (
                  <tr key={u._id} id={`user-row-${u._id}`} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s', background: highlightedUserId === u._id ? 'rgba(99, 102, 241, 0.12)' : undefined, boxShadow: highlightedUserId === u._id ? 'inset 3px 0 0 var(--primary)' : undefined }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '50%',
                          background: u.profilePicture ? 'transparent' : 'var(--primary)',
                          backgroundImage: u.profilePicture ? `url(${u.profilePicture.startsWith('/uploads') ? SERVER_ORIGIN + u.profilePicture : u.profilePicture})` : 'none',
                          backgroundSize: 'cover', backgroundPosition: 'center',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.85rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {!u.profilePicture && getInitials(u.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {u.name}
                            {isMe && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'var(--primary-glow)', padding: '1px 6px', borderRadius: '8px' }}>You</span>}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.username || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', background: u.status === 'Approved' ? 'rgba(16,185,129,0.1)' : u.status === 'Rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: u.status === 'Approved' ? 'var(--success)' : u.status === 'Rejected' ? 'var(--error)' : 'var(--warning)', fontWeight: 600 }}>
                        {u.status || 'Approved'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {u.status === 'Pending Approval' && (
                          <>
                            <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => handleApprove(u)}>Approve</button>
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--error)' }} onClick={() => handleReject(u)}>Reject</button>
                          </>
                        )}
                        {!isMe && u.status !== 'Pending Approval' && (
                          <button className="btn" style={{ padding: '6px 10px', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', borderRadius: '6px' }} onClick={() => setDeleteTarget(u)} title="Delete user">
                            <Trash2 size={15} />
                          </button>
                        )}
                        {isMe && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title="Create New User">
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Full Name *</label>
              <input type="text" className="form-input" placeholder="Enter full name" value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Username (optional)</label>
              <input type="text" className="form-input" value={form.username} onChange={(e) => handleFormChange('username', e.target.value)} placeholder="Leave blank to auto-generate" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email *</label>
            <input type="email" className="form-input" placeholder="Enter email address" value={form.email} onChange={(e) => handleFormChange('email', e.target.value)} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Initial Password</label>
            <PasswordInput value={form.password} onChange={(e) => handleFormChange('password', e.target.value)} placeholder="Default: 12345678" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
            <button type="button" className="btn" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner spinner-sm" /> : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete User">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong>?
            This will remove them from all projects and cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className="btn"
              style={{ background: 'var(--error)', color: '#fff', border: 'none' }}
              onClick={handleDeleteUser}
            >
              <Trash2 size={16} /> Delete User
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UserManagement;