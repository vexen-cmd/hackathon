import React, { useState } from 'react';
import { ShieldCheck, Cpu, HelpCircle, Lock, X, CheckCircle2 } from 'lucide-react';

export default function Navbar({ health, isHealthy }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <header className="navbar">
        <div className="nav-brand">
          <div className="brand-icon-box">
            <ShieldCheck size={20} color="#ffffff" />
          </div>
          <div>
            <div className="brand-title">
              Snippet<span>Studio</span>
              <span className="brand-subtitle">HARNESS v2.0</span>
            </div>
          </div>
        </div>

        <div className="nav-meta">
          <div className="engine-badge">
            <span className={`status-dot ${isHealthy ? '' : 'warning'}`}></span>
            <Cpu size={14} color="#94a3b8" />
            <span style={{ fontWeight: 500 }}>
              {isHealthy ? `Ollama (${health?.ollama_host || 'Local'})` : 'Connecting Engine...'}
            </span>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
            title="Architecture & Safety Model"
          >
            <HelpCircle size={14} />
            Safety Architecture
          </button>
        </div>
      </header>

      {/* Architecture & Safety Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              maxWidth: '680px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Lock size={20} color="#10b981" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Deterministic Safety Harness</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.6 }}>
              <p>
                <strong>Snippet Studio</strong> separates text generation from deterministic decision control.
                The LLM (Qwen via Ollama) is an <em>untrusted generator</em>: it can propose explanations and documentation, but cannot bypass review.
              </p>

              <div style={{ background: '#1e293b', padding: '0.85rem', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                <strong style={{ color: '#34d399', display: 'block', marginBottom: '0.25rem' }}>
                  Hash-Bound Approval Receipts (CE-TC3)
                </strong>
                Approval is bound to the canonical SHA-256 hash of the detected language, explanation, and documentation. Editing an explanation after approval changes the hash and invalidates the approval as stale (HTTP 409).
              </div>

              <div style={{ background: '#1e293b', padding: '0.85rem', borderRadius: '8px', borderLeft: '4px solid #ef4444' }}>
                <strong style={{ color: '#f87171', display: 'block', marginBottom: '0.25rem' }}>
                  Prompt-Injection Protection (CE-TC4)
                </strong>
                Snippets containing phrases like <code># skip approval</code> are treated purely as data. They are recorded in the untrusted Evidence Ledger and cannot alter state machine transitions or auto-approve output.
              </div>

              <div style={{ background: '#1e293b', padding: '0.85rem', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                <strong style={{ color: '#60a5fa', display: 'block', marginBottom: '0.25rem' }}>
                  Tamper-Evident Chained Event Log
                </strong>
                Every workflow state transition cryptographically chains to the previous state's SHA-256 hash. Delivered artifacts report whether the complete event chain verifies.
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                <CheckCircle2 size={16} /> Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
