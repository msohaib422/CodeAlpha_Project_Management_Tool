import React, { useContext } from 'react';
import { NotificationContext } from '../context/NotificationContext';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContainer = () => {
  const { toasts, removeToast } = useContext(NotificationContext);

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} color="var(--success)" />;
      case 'error':
        return <XCircle size={20} color="var(--error)" />;
      case 'warning':
        return <AlertTriangle size={20} color="var(--warning)" />;
      default:
        return <Info size={20} color="var(--info)" />;
    }
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type} glass-panel`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            {getIcon(toast.type)}
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{toast.message}</span>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              padding: '2px',
            }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
