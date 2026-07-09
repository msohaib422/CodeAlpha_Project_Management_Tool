import React, { useState, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { NotificationContext } from '../context/NotificationContext';
import API from '../services/api';
import { Sun, Moon, ShieldAlert, KeyRound, Monitor } from 'lucide-react';

const Settings = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { addToast } = useContext(NotificationContext);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword || !password || !confirmPassword) {
      addToast('Please fill in all password fields', 'error');
      return;
    }

    if (password !== confirmPassword) {
      addToast('New passwords do not match', 'error');
      return;
    }

    if (password.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }

    setLoading(true);
    try {
      await API.put('/users/profile', {
        currentPassword,
        password,
      });

      addToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      addToast(error.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Manage your interface preference and security settings
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '650px' }}>
        {/* Theme Settings */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Monitor size={20} color="var(--primary)" />
            <span>Theme Preferences</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Choose how CollabPM looks. Select between Dark mode first (recommended) and Light mode.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', padding: '16px 20px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {theme === 'dark' ? <Moon size={20} color="var(--primary)" /> : <Sun size={20} color="var(--warning)" />}
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Currently: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <button className="btn btn-primary" onClick={toggleTheme} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              Toggle Theme
            </button>
          </div>
        </div>

        {/* Change Password Settings */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <KeyRound size={20} color="var(--primary)" />
            <span>Change Password</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
            Ensure your account security by updating your credential tokens regularly.
          </p>

          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter new password (min. 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner spinner-sm"></span> : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
