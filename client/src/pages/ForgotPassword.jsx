import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { FolderKanban } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { data } = await API.post('/auth/forgot-password', { email });
      setMessage(data.message);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to process request. Please try again.');
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
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '6px' }}>Forgot Password</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Enter your registered email to receive a reset link
          </p>
        </div>

        {message && (
          <div style={{ background: 'var(--info-bg)', color: 'var(--text-primary)', padding: '12px', borderRadius: 'var(--border-radius-sm)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid var(--card-border)' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }} disabled={loading}>
            {loading ? <span className="spinner spinner-sm"></span> : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem' }}>
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;