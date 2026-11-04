import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import { FolderKanban, UserPlus } from 'lucide-react';

const Register = () => {
  const [step, setStep] = useState('form'); // form | otp | done
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loadingState, setLoadingState] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoadingState(true);
    try {
      await API.post('/auth/register', { name, username, email, password });
      setStep('otp');
      setCooldown(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoadingState(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp) { setError('Enter the OTP'); return; }
    setLoadingState(true);
    try {
      await API.post('/auth/verify-otp', { email, otp });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoadingState(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    try {
      await API.post('/auth/resend-otp', { email });
      setCooldown(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%), var(--bg-primary)', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '40px 30px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px', borderRadius: '12px', background: 'var(--primary-glow)', color: 'var(--primary)', marginBottom: '16px' }}>
            <FolderKanban size={28} />
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '6px' }}>
            {step === 'form' && 'Get Started'}
            {step === 'otp' && 'Verify Email'}
            {step === 'done' && 'Registration Pending'}
          </h1>
        </div>

        {error && (
          <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '12px', borderRadius: 'var(--border-radius-sm)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} disabled={loadingState} />
            </div>
            <div className="form-group">
              <label className="form-label">Username (optional)</label>
              <input type="text" className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} disabled={loadingState} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loadingState} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loadingState} />
            </div>
            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loadingState} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loadingState}>
              {loadingState ? <span className="spinner spinner-sm" /> : <><UserPlus size={18} /><span>Create Account</span></>}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerify}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>We sent a 6-digit code to {email}.</p>
            <div className="form-group">
              <label className="form-label">OTP Code</label>
              <input type="text" className="form-input" value={otp} onChange={(e) => setOtp(e.target.value)} disabled={loadingState} maxLength={6} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loadingState}>
              {loadingState ? <span className="spinner spinner-sm" /> : 'Verify Email'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleResend} disabled={cooldown > 0 || loadingState}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Your email has been verified. Your registration is now pending admin approval. You will be notified once approved.
            </p>
            <Link to="/login" className="btn btn-primary">Go to Login</Link>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Already have an account? </span>
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Log In</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
