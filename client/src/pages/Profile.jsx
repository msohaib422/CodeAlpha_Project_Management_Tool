import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import { Mail, Award } from 'lucide-react';

const Profile = () => {
  const { user, updateProfile } = useContext(AuthContext);
  const { addToast } = useContext(NotificationContext);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Set fields on mount / user change
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      addToast('Name and email are required', 'error');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('bio', bio);
    if (file) {
      formData.append('profilePicture', file);
    }

    const res = await updateProfile(formData);
    setSubmitting(false);

    if (res.success) {
      addToast('Profile updated successfully!', 'success');
      setFile(null);
      setPreviewUrl(null);
    } else {
      addToast(res.message || 'Update failed', 'error');
    }
  };

  const getInitials = (n) => {
    if (!n) return 'U';
    return n.split(' ').map((i) => i[0]).join('').substring(0, 2).toUpperCase();
  };

  const avatarSrc = previewUrl || (user?.profilePicture
    ? (user.profilePicture.startsWith('/uploads') ? `http://localhost:5000${user.profilePicture}` : user.profilePicture)
    : null);

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile Settings</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Update your personal information, avatar and password
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px', maxWidth: '900px' }}>
        {/* Left Side: Avatar Card */}
        <div className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: 'fit-content' }}>
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              marginBottom: '12px',
              border: '3px solid var(--primary)',
              boxShadow: '0 0 0 4px var(--primary-glow)',
              background: avatarSrc ? 'transparent' : 'var(--primary)',
              backgroundImage: avatarSrc ? `url(${avatarSrc})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {!avatarSrc && getInitials(name)}
          </div>
          
          <label htmlFor="avatar-upload" style={{
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: 'var(--primary)',
            fontWeight: 600,
            marginBottom: '20px',
            padding: '6px 14px',
            border: '1px solid var(--primary)',
            borderRadius: '20px',
          }}>
            Change Photo
            <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/jpg" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
          
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '2px', textAlign: 'center' }}>{user?.name}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '6px' }}>@{user?.username || 'N/A'}</p>
          <p style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '20px' }}>{user?.role}</p>

          <div style={{ width: '100%', borderTop: '1px solid var(--card-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <Mail size={14} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</span>
            </div>
            {user?.department && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <Award size={14} />
                <span>{user.department}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Edit Form */}
        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
              value={user?.username || ''}
              disabled
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Bio</label>
            <textarea
              className="form-input"
              style={{ minHeight: '80px', resize: 'vertical' }}
              placeholder="Tell us about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px', marginTop: '8px' }} disabled={submitting}>
            {submitting ? <span className="spinner spinner-sm"></span> : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
