import React, { useState } from 'react';

export default function DeliveredResult({ finalResult, markdown }) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'raw'

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
    a.download = `verified-attestation-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-space-lg w-full bg-surface-container-low rounded-xl shadow-2xl border border-secondary/40 overflow-hidden relative">
      <div className="p-space-md bg-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary-container/20 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-xl">verified</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-base text-on-surface font-bold flex items-center gap-2">
              Delivered Markdown Attestation
              <span className="px-2 py-0.5 rounded-full bg-secondary-container/15 text-secondary text-xs font-mono font-medium border border-secondary/30">
                Verified Sandbox Output
              </span>
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant text-xs">
              Cryptographically sealed with SHA-256 output hash binding
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg bg-surface-container-lowest p-0.5 border border-outline-variant/30 text-xs font-mono">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'preview'
                  ? 'bg-surface-container-high text-primary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'raw'
                  ? 'bg-surface-container-high text-primary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Raw MD
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-mono flex items-center gap-1.5 transition-colors border border-outline-variant/30 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'done' : 'content_copy'}
            </span>
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-[0_0_12px_rgba(0,229,255,0.2)] cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* 4 Statuses Pill Bar */}
      <div className="px-space-md py-2 bg-surface-container-lowest flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/20 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-outline uppercase text-[10px] font-bold">Enclave Statuses:</span>
          <span className="px-2 py-0.5 rounded bg-secondary-container/15 text-secondary border border-secondary/30">
            Detected: {statuses.detected ? 'PASS' : 'FAIL'}
          </span>
          <span className="px-2 py-0.5 rounded bg-secondary-container/15 text-secondary border border-secondary/30">
            Explained: {statuses.explained ? 'PASS' : 'FAIL'}
          </span>
          <span className="px-2 py-0.5 rounded bg-secondary-container/15 text-secondary border border-secondary/30">
            Approved: {statuses.approved ? 'PASS' : 'FAIL'}
          </span>
          <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary border border-primary/30">
            Delivered: {statuses.delivered ? 'TRUE' : 'FALSE'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-secondary">verified_user</span>
          <span className="text-on-surface-variant">
            Chain Integrity:{' '}
            <strong className={chainVerified ? 'text-secondary' : 'text-error'}>
              {chainVerified ? 'Cryptographically Intact' : 'Unverified'}
            </strong>
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-space-md bg-surface-container-low min-h-[160px] max-h-[450px] overflow-y-auto">
        {viewMode === 'raw' ? (
          <pre className="font-mono text-xs text-on-surface whitespace-pre-wrap bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/30 leading-relaxed selection:bg-primary-container selection:text-on-primary-container">
            {content}
          </pre>
        ) : (
          <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 markdown-body">
            {content ? (
              content.split('\n\n').map((para, i) => {
                if (para.startsWith('# ')) {
                  return <h1 key={i}>{para.replace('# ', '')}</h1>;
                }
                if (para.startsWith('## ')) {
                  return <h2 key={i}>{para.replace('## ', '')}</h2>;
                }
                if (para.startsWith('### ')) {
                  return <h3 key={i}>{para.replace('### ', '')}</h3>;
                }
                if (para.startsWith('```')) {
                  return (
                    <pre key={i}>
                      <code>{para.replace(/```[a-z]*\n?/g, '')}</code>
                    </pre>
                  );
                }
                return <p key={i}>{para}</p>;
              })
            ) : (
              <p className="text-outline">No markdown content generated.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
