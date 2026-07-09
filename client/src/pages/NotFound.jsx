import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';

const NotFound = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        textAlign: 'center',
        padding: '20px',
        animation: 'fadeIn 0.4s ease-out',
      }}
    >
      <ShieldAlert size={64} color="var(--error)" style={{ marginBottom: '20px', opacity: 0.8 }} />
      <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '10px' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px' }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '30px', fontSize: '0.95rem' }}>
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link to="/" className="btn btn-primary">
        <Home size={16} />
        <span>Return Dashboard</span>
      </Link>
    </div>
  );
};

export default NotFound;
