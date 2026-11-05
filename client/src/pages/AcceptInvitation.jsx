import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import { FolderKanban, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const AcceptInvitation = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');
  const [projectId, setProjectId] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/login?redirect=/invitations/${id}/accept`, { replace: true });
      return;
    }

    let cancelled = false;
    const accept = async () => {
      try {
        const { data } = await API.put(`/invitations/${id}/respond`, { status: 'Accepted' });
        if (cancelled) return;
        const inv = data.invitation || {};
        const pid = inv.project?._id || inv.project;
        setProjectId(pid || null);
        setStatus('success');
        setMessage(data.message || 'Invitation accepted successfully.');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err.response?.data?.message || 'Failed to accept invitation.');
      }
    };
    accept();
    return () => { cancelled = true; };
  }, [id, user, authLoading, navigate]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '40px 30px', textAlign: 'center', border: 'none' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', background: 'var(--primary-glow)', color: 'var(--primary)', marginBottom: '18px' }}>
          <FolderKanban size={28} />
        </div>
        {status === 'loading' && (
          <>
            <Loader2 size={28} className="spinner" style={{ marginBottom: '12px' }} />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Accepting invitation…</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Please wait while we process your invitation.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={40} color="var(--success)" style={{ marginBottom: '12px' }} />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Invitation accepted</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{message}</p>
            <button className="btn btn-primary" onClick={() => navigate(projectId ? `/projects/${projectId}` : '/projects')}>
              Go to Project
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={40} color="var(--error)" style={{ marginBottom: '12px' }} />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Unable to accept</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>{message}</p>
            <button className="btn btn-secondary" onClick={() => navigate('/notifications')}>Go to Notifications</button>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptInvitation;