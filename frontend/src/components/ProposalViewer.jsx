import React, { useState } from 'react';
import {
  FileText,
  Hash,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Edit3,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';

export default function ProposalViewer({
  proposal,
  workflowState,
  requestId,
  onReview,
  onSimulateStaleAttack,
  isReviewing,
  explanation,
  setExplanation,
  documentation,
  setDocumentation,
}) {
  const [approverId, setApproverId] = useState('reviewer-human');
  const [copiedHash, setCopiedHash] = useState(false);

  const copyHash = async () => {
    if (!proposal?.output_hash) return;
    try {
      await navigator.clipboard.writeText(proposal.output_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // ignore
    }
  };

  const isDelivered = workflowState === 'delivered';
  const isRejected = workflowState === 'rejected';
  const isAwaitingReview = workflowState === 'awaiting_review' || workflowState === 'proposing_docs';

  if (!proposal) {
    return (
      <div className="workbench-card">
        <div className="card-header">
          <div className="card-title-group">
            <span className="step-indicator">02</span>
            <h2 className="card-title">Harness Proposal</h2>
          </div>
          <span className="status-step-pill">READY</span>
        </div>

        <div className="empty-placeholder">
          <div className="empty-icon-wrap">
            <FileText size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.25rem' }}>
              No Proposal Generated Yet
            </h3>
            <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: '340px' }}>
              Paste a snippet on the left and select <strong>Analyze Snippet</strong>. The deterministic harness will isolate untrusted model output into a reviewable proposal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workbench-card">
      <div className="card-header">
        <div className="card-title-group">
          <span className="step-indicator">02</span>
          <h2 className="card-title">Harness Proposal</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`status-step-pill ${isDelivered ? 'complete' : isRejected ? 'failed' : 'active'}`}>
            {workflowState.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Proposal Metadata */}
      <div className="proposal-body">
        <div className="proposal-meta-row">
          <div className="meta-field">
            <span className="meta-label">Detected Language:</span>
            <strong style={{ color: '#38bdf8' }}>{proposal.language?.name || 'Unknown'}</strong>
            {proposal.language?.confidence && (
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                ({Math.round(proposal.language.confidence * 100)}% conf)
              </span>
            )}
          </div>

          <div className="meta-field">
            <span className="meta-label">Output Hash:</span>
            <div className="hash-badge" title="Canonical SHA-256 bound to approval">
              <Hash size={12} />
              <span>{proposal.output_hash?.slice(0, 16)}...</span>
              <button
                type="button"
                onClick={copyHash}
                style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: 0 }}
              >
                {copiedHash ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        </div>

        {/* Explanation Field */}
        <div className="field-group">
          <div className="field-header">
            <label className="field-title" htmlFor="explanation-input">
              Explanation <span style={{ color: '#64748b' }}>(Untrusted LLM Proposal)</span>
            </label>
            {isAwaitingReview && (
              <span className="field-edit-note">
                <Edit3 size={11} style={{ display: 'inline', marginRight: 3 }} />
                Editable
              </span>
            )}
          </div>
          <textarea
            id="explanation-input"
            className="text-input-field explanation-field"
            rows={5}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            disabled={!isAwaitingReview || isReviewing}
            placeholder="Generated explanation will appear here..."
          />
        </div>

        {/* Documentation Field */}
        <div className="field-group">
          <div className="field-header">
            <label className="field-title" htmlFor="documentation-input">
              Documentation Proposal
            </label>
            {isAwaitingReview && (
              <span className="field-edit-note">
                <Edit3 size={11} style={{ display: 'inline', marginRight: 3 }} />
                Editable
              </span>
            )}
          </div>
          <textarea
            id="documentation-input"
            className="text-input-field documentation-field"
            rows={10}
            value={documentation}
            onChange={(e) => setDocumentation(e.target.value)}
            disabled={!isAwaitingReview || isReviewing}
            placeholder="Generated documentation will appear here..."
          />
        </div>

        {/* Human Review Panel */}
        {isAwaitingReview && (
          <div className="review-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600 }}>
              <Lock size={14} />
              <span>CRYPTOGRAPHIC HUMAN APPROVAL GATEWAY</span>
            </div>

            <div className="review-input-row">
              <label htmlFor="approver-id-input">Reviewer ID:</label>
              <input
                id="approver-id-input"
                className="approver-input"
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                placeholder="e.g. security-lead-1"
                disabled={isReviewing}
              />
            </div>

            <div className="review-actions-bar">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => onReview({ decision: 'reject', approverId })}
                disabled={isReviewing || !approverId.trim()}
              >
                <XCircle size={15} /> Reject
              </button>

              <button
                type="button"
                className="btn btn-warning"
                onClick={() => onSimulateStaleAttack({ approverId })}
                disabled={isReviewing || !approverId.trim()}
                title="Test CE-TC3: Demonstrates that altering content without re-hashing is trapped with HTTP 409"
              >
                <AlertTriangle size={15} /> Test Stale Approval (CE-TC3)
              </button>

              <button
                type="button"
                className="btn btn-success"
                onClick={() => onReview({ decision: 'approve', approverId })}
                disabled={isReviewing || !approverId.trim()}
              >
                <CheckCircle size={15} /> Approve & Deliver
              </button>
            </div>
          </div>
        )}

        {/* State messages for non-awaiting review */}
        {isDelivered && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6ee7b7', fontSize: '0.85rem' }}>
            <CheckCircle size={16} />
            <span>Proposal approved and cryptographically delivered to Markdown.</span>
          </div>
        )}

        {isRejected && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontSize: '0.85rem' }}>
            <XCircle size={16} />
            <span>Proposal was rejected by human reviewer. Workflow halted before delivery.</span>
          </div>
        )}
      </div>
    </div>
  );
}
