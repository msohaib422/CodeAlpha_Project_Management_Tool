import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import API from '../services/api';
import PasswordInput from '../components/PasswordInput';
import { FolderKanban } from 'lucide-react';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [valid, setValid] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setValid(false);
      return;
    }
    API.get(`/auth/reset-password/${token}`)
      .then((res) => setValid(!!res.data.valid))
      .catch(() => setValid(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { data } = await API.post('/auth/reset-password', { token, password, confirmPassword });
      setMessage(data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%), var(--bg-primary)', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px 30px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px', borderRadius: '12px', background: 'var(--primary-glow)', color: 'var(--primary)', marginBottom: '16px' }}>
            <FolderKanban size={28} />
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '6px' }}>Reset Password</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Enter your new password
          </p>
        </div>

        {valid === false && (
          <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '12px', borderRadius: 'var(--border-radius-sm)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            This reset link is invalid or has expired.
          </div>
        )}

        {message && (
          <div style={{ background: 'var(--info-bg)', color: 'var(--text-primary)', padding: '12px', borderRadius: 'var(--border-radius-sm)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid var(--card-border)' }}>
            {message}
          </div>
        )}

        {valid && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <PasswordInput
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label">Confirm New Password</label>
              <PasswordInput
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }} disabled={loading}>
              {loading ? <span className="spinner spinner-sm"></span> : 'Reset Password'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem' }}>
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;