import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export default function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type || 'info'}`}>
          {t.type === 'error' && <AlertCircle size={18} color="#ef4444" />}
          {t.type === 'success' && <CheckCircle size={18} color="#10b981" />}
          {t.type === 'warning' && <AlertTriangle size={18} color="#f59e0b" />}
          {(!t.type || t.type === 'info') && <Info size={18} color="#3b82f6" />}

          <span style={{ flex: 1 }}>{t.message}</span>

          <button
            onClick={() => onDismiss(t.id)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
