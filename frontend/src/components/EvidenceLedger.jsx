import React from 'react';
import { Database, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function EvidenceLedger({ evidence = [] }) {
  const untrustedItems = evidence.filter((e) => e.trust === 'untrusted');
  const hasInjection = untrustedItems.some((e) => e.extracted?.matched_phrase);

  return (
    <div className="workbench-card">
      <div className="card-header">
        <div className="card-title-group">
          <Database size={16} color="#f59e0b" />
          <h2 className="card-title">Evidence Ledger (CE-TC4 Isolation)</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {hasInjection && (
            <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <ShieldAlert size={12} />
              Prompt Injection Blocked
            </span>
          )}
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: '#1e293b', padding: '0.2rem 0.55rem', borderRadius: '4px', fontWeight: 600 }}>
            {evidence.length} RECORD{evidence.length === 1 ? '' : 'S'}
          </span>
        </div>
      </div>

      <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {evidence.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            No evidence recorded in current session.
          </div>
        ) : (
          evidence.map((item, index) => {
            const isUntrusted = item.trust === 'untrusted';
            const matchedPhrase = item.extracted?.matched_phrase;

            return (
              <div
                key={index}
                className="evidence-item"
                style={{
                  background: matchedPhrase ? 'rgba(239, 68, 68, 0.08)' : undefined,
                  borderLeft: matchedPhrase ? '3px solid #ef4444' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`evidence-badge ${item.trust}`}>
                      {isUntrusted ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                      {item.trust}
                    </span>
                    <strong style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>{item.note || 'Evidence entry'}</strong>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {item.retrieved_at ? new Date(item.retrieved_at).toLocaleTimeString() : ''}
                  </span>
                </div>

                {matchedPhrase && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '0.4rem 0.6rem', borderRadius: '4px', color: '#fca5a5', fontSize: '0.75rem', fontWeight: 500 }}>
                    ⚠️ Untrusted instruction detected in source: <code>"{matchedPhrase}"</code>
                    <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                      Deterministic harness isolated this phrase. Human review is strictly enforced.
                    </div>
                  </div>
                )}

                {item.extracted && !matchedPhrase && (
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', background: '#0b0f19', padding: '0.35rem 0.5rem', borderRadius: '4px', overflowX: 'auto' }}>
                    <code>{JSON.stringify(item.extracted)}</code>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="card-footer" style={{ padding: '0.65rem 1.25rem', fontSize: '0.75rem', color: '#64748b' }}>
        <span>CE-TC4: Snippet content is untrusted data; it can never bypass review or trigger auto-approval.</span>
      </div>
    </div>
  );
}
