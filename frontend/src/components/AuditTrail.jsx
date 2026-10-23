import React from 'react';
import { History, ShieldCheck, Activity } from 'lucide-react';

export default function AuditTrail({ events = [] }) {
  return (
    <div className="workbench-card">
      <div className="card-header">
        <div className="card-title-group">
          <History size={16} color="#60a5fa" />
          <h2 className="card-title">Cryptographic Audit Trail</h2>
        </div>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: '#1e293b', padding: '0.2rem 0.55rem', borderRadius: '4px', fontWeight: 600 }}>
          {events.length} EVENT{events.length === 1 ? '' : 'S'}
        </span>
      </div>

      <div className="audit-events" style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            <Activity size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            No state transitions recorded yet.
          </div>
        ) : (
          events.map((event, index) => {
            const timeStr = event.at ? new Date(event.at).toLocaleTimeString() : '—';
            return (
              <div key={index} className="activity-item">
                <span className="activity-seq">
                  {String(event.seq !== undefined ? event.seq : index + 1).padStart(2, '0')}
                </span>

                <div className="activity-content">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                    <span className="activity-state-name">{event.state}</span>
                    <span className="activity-time">{timeStr}</span>
                  </div>

                  {event.hash && (
                    <div className="activity-hash">
                      <span>chain_hash: </span>
                      <code>{event.hash.slice(0, 24)}...</code>
                    </div>
                  )}

                  {event.detail && Object.keys(event.detail).length > 0 && (
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      {Object.entries(event.detail).map(([k, v]) => (
                        <span key={k} style={{ marginRight: '0.75rem' }}>
                          <span style={{ color: '#64748b' }}>{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card-footer" style={{ padding: '0.65rem 1.25rem', fontSize: '0.75rem', color: '#64748b' }}>
        <ShieldCheck size={13} color="#10b981" />
        <span>Transitions are cryptographically chained to prevent retroactive log alteration.</span>
      </div>
    </div>
  );
}
