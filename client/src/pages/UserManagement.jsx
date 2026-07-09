import React, { useState, useEffect, useContext } from 'react';
import { UserPlus, Trash2, Shield, Phone, Building2, BadgeCheck, Search, X } from 'lucide-react';
import API from '../services/api';
import Modal from '../components/Modal';
import { NotificationContext } from '../context/NotificationContext';
import { AuthContext } from '../context/AuthContext';

const PROJECT_ROLES_DISPLAY = {
  'Admin': { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  'Project Manager': { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  'Senior Developer': { color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  'Backend Developer': { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  'Frontend Developer': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  'UI/UX Designer': { color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
  'QA Engineer': { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  'DevOps Engineer': { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
};

const getRoleStyle = (role) =>
  PROJECT_ROLES_DISPLAY[role] || { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)' };

const getInitials = (name) => {
  if (!name) return 'U';
  return name.split(' ').map((i) => i[0]).join('').substring(0, 2).toUpperCase();
};

const UserManagement = () => {
  const { user: currentUser } = useContext(AuthContext);
  const { addToast } = useContext(NotificationContext);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');

  // Form State
  const [form, setForm] = useState({
    name: '', email: '', username: '', role: '',
    department: '', phoneNumber: '', employeeId: '', password: '12345678',
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

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

  const fetchRoles = async () => {
    try {
      const { data } = await API.get('/users/roles');
      setRoles(data);
    } catch (error) {
      console.error('Failed to fetch roles');
    }
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.role) {
      addToast('Name, email and role are required', 'error');
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

  const resetForm = () => {
    setForm({
      name: '', email: '', username: '', role: '',
      department: '', phoneNumber: '', employeeId: '', password: '12345678',
    });
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(search.toLowerCase())
  );

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '60px' }}>
        <Shield size={48} color="var(--error)" style={{ marginBottom: '16px' }} />
        <h2>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Only the Admin can access User Management.</p>
      </div>
    );
  }

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

      {/* Search bar */}
      <div style={{ position: 'relative', maxWidth: '380px', marginBottom: '20px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="form-input"
          placeholder="Search by name, email or role..."
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

      {/* Users Table */}
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Role', 'Department', 'Employee ID', 'Phone', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const rs = getRoleStyle(u.role);
                const isMe = u._id === currentUser._id;
                const isRootAdmin = u.role === 'Admin';
                return (
                  <tr key={u._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '50%',
                          background: u.profilePicture ? 'transparent' : 'var(--primary)',
                          backgroundImage: u.profilePicture ? `url(${u.profilePicture.startsWith('/uploads') ? 'http://localhost:5000' + u.profilePicture : u.profilePicture})` : 'none',
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
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '12px', background: rs.bg, color: rs.color, fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.department || '—'}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.employeeId || '—'}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{u.phoneNumber || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      {!isMe && !isRootAdmin ? (
                        <button
                          className="btn"
                          style={{ padding: '6px 10px', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', borderRadius: '6px' }}
                          onClick={() => setDeleteTarget(u)}
                          title="Delete user"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isRootAdmin ? 'Protected' : '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title="Create New User">
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Full Name *</label>
              <input type="text" className="form-input" placeholder='Enter Name' value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Username (optional)</label>
              <input type="text" className="form-input" value={form.username} onChange={(e) => handleFormChange('username', e.target.value)} placeholder="auto-generated if blank" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email *</label>
            <input type="email" className="form-input" placeholder='Enter Email' value={form.email} onChange={(e) => handleFormChange('email', e.target.value)} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Organization Role *</label>
            <select className="form-input" value={form.role} onChange={(e) => handleFormChange('role', e.target.value)} required style={{ cursor: 'pointer' }}>
              <option value="">— Select Role —</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Department</label>
              <input type="text" className="form-input" value={form.department} onChange={(e) => handleFormChange('department', e.target.value)} placeholder="e.g. Engineering" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Employee ID</label>
              <input type="text" className="form-input" value={form.employeeId} onChange={(e) => handleFormChange('employeeId', e.target.value)} placeholder="e.g. EMP-001" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Phone Number</label>
              <input type="tel" className="form-input" value={form.phoneNumber} onChange={(e) => handleFormChange('phoneNumber', e.target.value)} placeholder="e.g. +92-300-1234567" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Initial Password</label>
              <input type="text" className="form-input" value={form.password} onChange={(e) => handleFormChange('password', e.target.value)} placeholder="Default: 12345678" />
            </div>
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            ℹ️ The user will receive this password and should change it upon first login. Admin cannot be created from this form.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
            <button type="button" className="btn" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner spinner-sm" /> : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
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
