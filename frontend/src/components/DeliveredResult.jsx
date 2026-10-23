import React, { useState } from 'react';
import { ShieldCheck, Copy, Download, Check, FileCheck, Layers } from 'lucide-react';

export default function DeliveredResult({ finalResult, markdown }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');

  if (!finalResult && !markdown) return null;

  const content = markdown || finalResult?.formatted_markdown || '';
  const chainVerified = finalResult?.event_chain_verified;
  const statuses = finalResult?.four_statuses || {
    detected: true,
    explained: true,
    approved: true,
    delivered: true,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documented-snippet-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="workbench-card" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
      <div className="card-header" style={{ background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, #0f172a 100%)' }}>
        <div className="card-title-group">
          <FileCheck size={18} color="#34d399" />
          <h2 className="card-title" style={{ color: '#34d399' }}>Delivered Documentation</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className={`chain-verified-pill ${chainVerified ? '' : 'tampered'}`}>
            <ShieldCheck size={14} />
            <span>Chain Verified: {chainVerified ? 'TRUE' : 'FAILED'}</span>
          </div>
        </div>
      </div>

      {/* 4 Statuses Pill Bar */}
      <div className="status-strip-wrapper">
        <div className="status-step-pills">
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '0.25rem', fontWeight: 600 }}>
            FOUR STATUSES:
          </span>
          <span className={`status-step-pill ${statuses.detected ? 'complete' : ''}`}>
            ✓ Detected
          </span>
          <span className={`status-step-pill ${statuses.explained ? 'complete' : ''}`}>
            ✓ Explained
          </span>
          <span className={`status-step-pill ${statuses.approved ? 'complete' : ''}`}>
            ✓ Approved
          </span>
          <span className={`status-step-pill ${statuses.delivered ? 'complete' : ''}`}>
            ✓ Delivered
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('preview')}
            className={`btn ${activeTab === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
          >
            Formatted Preview
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`btn ${activeTab === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
          >
            Raw Markdown
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flex: 1, flexDirection: 'column', gap: '1rem' }}>
        <div className="markdown-preview-container">
          {activeTab === 'raw' ? (
            <pre style={{ margin: 0, color: '#93c5fd' }}>{content}</pre>
          ) : (
            <div style={{ color: '#f8fafc', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {content}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem' }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={14} />
            <span>Output is ready for repository commit or documentation wiki</span>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button onClick={handleCopy} className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem' }}>
              {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button onClick={handleDownload} className="btn btn-primary" style={{ padding: '0.45rem 0.85rem' }}>
              <Download size={14} />
              Download .md
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
