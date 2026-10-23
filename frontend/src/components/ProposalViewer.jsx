import React, { useState } from 'react';

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
  evidence = [],
}) {
  const [approverId, setApproverId] = useState('reviewer-human');
  const [isEditingExpl, setIsEditingExpl] = useState(false);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const isDelivered = workflowState === 'delivered';
  const isApproved = workflowState === 'approved' || isDelivered;
  const isRejected = workflowState === 'rejected';
  const hasProposal = Boolean(proposal);
  const tags = Array.isArray(proposal?.tags) ? proposal.tags : [];

  const untrustedItems = evidence.filter((e) => e.trust === 'untrusted');
  const hasAdversarialTaint = untrustedItems.some((e) => e.extracted?.matched_phrase);

  const copyDocumentation = async () => {
    try {
      await navigator.clipboard.writeText(documentation || proposal?.documentation || '');
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 1500);
    } catch {
      // ignore
    }
  };

  const copyMerkleHash = async () => {
    if (!proposal?.output_hash) return;
    try {
      await navigator.clipboard.writeText(proposal.output_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 1500);
    } catch {
      // ignore
    }
  };

  const getPipelineStatus = () => {
    if (isDelivered) return 'STAGE 4/4 COMPLETED';
    if (isApproved) return 'STAGE 3/4 APPROVED';
    if (hasProposal) return 'STAGE 3/4 AWAITING SIGN';
    if (workflowState === 'analyzing') return 'STAGE 1/4 ANALYZING';
    return 'STAGE 0/4 IDLE';
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 scroll-mt-20" id="analysis-results">
      {/* Top Status Pipeline Tracker */}
      <div className="p-4 bg-surface-container-low rounded-xl shadow-md border border-outline-variant/30">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono font-bold tracking-wider text-on-surface-variant uppercase">
            HARNESS PIPELINE STATE
          </span>
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase ${
              isDelivered ? 'text-primary bg-primary-container/15' : 'text-secondary bg-secondary-container/15'
            }`}
            id="pipeline-overall-status"
          >
            {getPipelineStatus()}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {/* Step 1: Detected */}
          <div
            className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-center transition-colors ${
              hasProposal ? 'bg-secondary-container/20 text-secondary' : 'bg-surface-container opacity-60 text-outline'
            }`}
          >
            <span className="material-symbols-outlined text-lg mb-1">
              {hasProposal ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <span className="text-[11px] font-mono font-bold">1. DETECTED</span>
          </div>

          {/* Step 2: Explained */}
          <div
            className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-center transition-colors ${
              hasProposal ? 'bg-secondary-container/20 text-secondary' : 'bg-surface-container opacity-60 text-outline'
            }`}
          >
            <span className="material-symbols-outlined text-lg mb-1">
              {hasProposal ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <span className="text-[11px] font-mono font-bold">2. EXPLAINED</span>
          </div>

          {/* Step 3: Approved */}
          <div
            className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-center transition-colors ${
              isApproved
                ? 'bg-secondary-container/20 text-secondary'
                : hasProposal
                ? 'bg-tertiary-container/20 text-tertiary-fixed-dim shadow-[0_0_12px_rgba(255,186,56,0.25)]'
                : 'bg-surface-container opacity-60 text-outline'
            }`}
            id="badge-approved"
          >
            <span
              className={`material-symbols-outlined text-lg mb-1 ${
                !isApproved && hasProposal ? 'animate-bounce text-tertiary-fixed-dim' : ''
              }`}
            >
              {isApproved ? 'check_circle' : hasProposal ? 'lock_clock' : 'radio_button_unchecked'}
            </span>
            <span className="text-[11px] font-mono font-bold">
              {isApproved ? '3. APPROVED' : '3. PENDING'}
            </span>
          </div>

          {/* Step 4: Delivered */}
          <div
            className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-center transition-colors ${
              isDelivered
                ? 'bg-primary-container/25 text-primary shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                : 'bg-surface-container opacity-60 text-outline'
            }`}
            id="badge-delivered"
          >
            <span className="material-symbols-outlined text-lg mb-1">
              {isDelivered ? 'verified' : 'radio_button_unchecked'}
            </span>
            <span className="text-[11px] font-mono font-bold">4. DELIVERED</span>
          </div>
        </div>
      </div>

      {!hasProposal ? (
        /* Empty State */
        <div className="p-8 bg-surface-container rounded-xl shadow-xl border border-outline-variant/30 text-center flex flex-col items-center justify-center min-h-[380px] flex-1">
          <div className="w-14 h-14 rounded-2xl bg-surface-container-high border border-primary/30 flex items-center justify-center text-primary mb-4 shadow-[0_0_20px_rgba(0,229,255,0.15)]">
            <span className="material-symbols-outlined text-3xl">security</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">
            Enclave Harness Standing By
          </h3>
          <p className="text-on-surface-variant text-sm max-w-md mb-6 leading-relaxed font-sans">
            Submit a code snippet on the left and select{' '}
            <strong className="text-primary font-semibold">Analyze Snippet</strong>. Untrusted LLM output will be isolated into a reviewable proposal awaiting your cryptographic sign-off.
          </p>
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm text-left">
            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
              <span className="text-xs font-mono font-bold text-secondary flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-sm">lock</span>
                CE-TC3 Hash Binding
              </span>
              <p className="text-xs text-on-surface-variant">Approval binds to the canonical output hash.</p>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
              <span className="text-xs font-mono font-bold text-primary flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-sm">shield</span>
                CE-TC4 Isolation
              </span>
              <p className="text-xs text-on-surface-variant">Untrusted strings quarantined in evidence ledger.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* AI Explanation Card */}
          <div className="p-5 bg-surface-container rounded-xl shadow-lg relative flex flex-col gap-3 border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-lg">psychology</span>
                </span>
                <h2 className="text-base font-bold text-on-surface">
                  AI Explanation
                </h2>
              </div>
              <button
                className="text-xs font-mono font-bold text-primary hover:text-on-surface flex items-center gap-1 transition-colors cursor-pointer px-2.5 py-1 rounded bg-surface-container-high border border-primary/25"
                onClick={() => setIsEditingExpl(!isEditingExpl)}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">edit_note</span>
                <span>{isEditingExpl ? 'Save & Close' : 'Edit Explanation'}</span>
              </button>
            </div>

            {isEditingExpl ? (
              <textarea
                className="w-full h-32 p-3 rounded-lg bg-surface-container-lowest text-on-surface font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary resize-none border border-outline-variant/40"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            ) : (
              <div className="text-sm font-sans text-on-surface-variant leading-relaxed">
                <p className="text-on-surface">
                  {explanation || proposal.explanation || 'No explanation generated.'}
                </p>
              </div>
            )}

            {/* Dynamic Metric Ribbon based on actual proposal data */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant/20">
              <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between border border-outline-variant/20">
                <span className="text-xs font-mono font-medium text-outline">Detected Language</span>
                <span className="text-sm font-mono text-primary font-bold flex items-center gap-1">
                  {proposal.language?.name || 'Unknown'}
                  {proposal.language?.confidence ? ` (${Math.round(proposal.language.confidence * 100)}%)` : ''}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between border border-outline-variant/20">
                <span className="text-xs font-mono font-medium text-outline">Evidence Taint</span>
                <span
                  className={`text-sm font-mono font-bold ${
                    hasAdversarialTaint ? 'text-error' : 'text-secondary'
                  }`}
                >
                  {hasAdversarialTaint ? 'Adversarial Flagged' : 'Zero Taints'}
                </span>
              </div>
            </div>

            {/* Knowledge-Base Tags (statement step 6) */}
            <div className="pt-2 border-t border-outline-variant/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-outline">
                  Knowledge-Base Tags
                </span>
                <span className="text-[11px] font-mono text-outline">
                  {tags.length}/4 labels
                </span>
              </div>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full bg-primary-container/15 text-primary text-[11px] font-mono font-semibold border border-primary/30"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] font-mono text-outline">No tags suggested.</span>
              )}
            </div>
          </div>

          {/* Generated Documentation Card */}
          <div className="p-5 bg-surface-container rounded-xl shadow-lg flex flex-col gap-3 border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-secondary/10 text-secondary">
                  <span className="material-symbols-outlined text-lg">description</span>
                </span>
                <h2 className="text-base font-bold text-on-surface">
                  Generated Documentation
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs font-mono font-bold text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer px-2.5 py-1 rounded bg-surface-container-high border border-outline-variant/30"
                  onClick={copyDocumentation}
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedDoc ? 'done' : 'content_copy'}
                  </span>
                  <span>{copiedDoc ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  className="text-xs font-mono font-bold text-primary hover:text-on-surface flex items-center gap-1 transition-colors cursor-pointer px-2.5 py-1 rounded bg-surface-container-high border border-primary/25"
                  onClick={() => setIsEditingDoc(!isEditingDoc)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  <span>{isEditingDoc ? 'Done' : 'Edit'}</span>
                </button>
              </div>
            </div>

            {isEditingDoc ? (
              <textarea
                className="w-full h-36 p-3 rounded-lg bg-surface-container-lowest text-on-surface font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary resize-none border border-outline-variant/40"
                value={documentation}
                onChange={(e) => setDocumentation(e.target.value)}
              />
            ) : (
              <div className="p-3.5 rounded-lg bg-surface-container-lowest font-mono text-xs text-on-surface-variant leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-52 overflow-y-auto border border-outline-variant/20">
                {documentation || proposal.documentation}
              </div>
            )}
          </div>

          {/* Bottom Cryptographic Approval Gateway */}
          <div
            className="p-5 bg-surface-container-high rounded-xl shadow-2xl relative overflow-hidden flex flex-col gap-4 border border-outline-variant/40"
            id="crypto-gateway-card"
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-secondary/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary-container/20 flex items-center justify-center text-secondary shrink-0">
                  <span className="material-symbols-outlined text-xl">key</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">
                    Cryptographic Approval Gateway
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Human sign-off on AI explanation &amp; audit digest
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded font-mono text-xs font-bold shrink-0 uppercase ${
                  isDelivered
                    ? 'bg-secondary-container/20 text-secondary border border-secondary/40'
                    : isRejected
                    ? 'bg-error-container/20 text-error border border-error/40'
                    : 'bg-tertiary-container/20 text-tertiary-fixed-dim border border-tertiary-fixed-dim/40'
                }`}
              >
                {workflowState.replace('_', ' ')}
              </span>
            </div>

            {/* Metadata Verification Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-surface-container flex flex-col border border-outline-variant/20">
                <span className="text-outline text-[11px] font-bold uppercase tracking-wider mb-0.5">
                  AUTHORIZED SIGNER
                </span>
                <input
                  type="text"
                  value={approverId}
                  onChange={(e) => setApproverId(e.target.value)}
                  className="bg-transparent text-on-surface font-semibold text-sm outline-none border-b border-transparent focus:border-primary truncate"
                />
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container flex flex-col border border-outline-variant/20">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-outline text-[11px] font-bold uppercase tracking-wider">
                    OUTPUT HASH (CE-TC3)
                  </span>
                  {proposal?.output_hash && (
                    <button
                      onClick={copyMerkleHash}
                      className="text-primary hover:text-on-surface text-xs flex items-center gap-1 cursor-pointer"
                      title="Copy canonical output hash"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {copiedHash ? 'done' : 'content_copy'}
                      </span>
                    </button>
                  )}
                </div>
                <span
                  className="text-primary font-bold font-mono text-sm truncate cursor-pointer"
                  title={proposal?.output_hash}
                >
                  {proposal?.output_hash
                    ? `${proposal.output_hash.slice(0, 14)}...${proposal.output_hash.slice(-6)}`
                    : 'Awaiting generation'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container flex flex-col border border-outline-variant/20">
                <span className="text-outline text-[11px] font-bold uppercase tracking-wider mb-0.5">
                  SESSION ID
                </span>
                <span className="text-secondary font-mono font-semibold text-xs truncate" title={requestId}>
                  {requestId ? `${requestId.slice(0, 16)}...` : 'Pending'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container flex flex-col border border-outline-variant/20">
                <span className="text-outline text-[11px] font-bold uppercase tracking-wider mb-0.5">
                  EVIDENCE RECORDS
                </span>
                <span className="text-secondary font-semibold text-xs">
                  {evidence.length} recorded ({untrustedItems.length} untrusted)
                </span>
              </div>
            </div>

            {/* Prominent Signing CTAs */}
            <div className="flex flex-col gap-2.5 pt-1">
              <button
                className="w-full py-3.5 px-6 rounded-xl text-base font-bold text-on-primary bg-secondary-container hover:bg-secondary transition-all shadow-[0_0_24px_rgba(5,231,119,0.35)] hover:shadow-[0_0_32px_rgba(5,231,119,0.55)] active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                onClick={() => onReview({ decision: 'approve', approverId })}
                disabled={isReviewing || isDelivered}
                id="btn-cryptographic-sign"
                type="button"
              >
                {isReviewing ? (
                  <>
                    <span className="material-symbols-outlined text-xl animate-spin">
                      progress_activity
                    </span>
                    <span>Submitting Decision to Enclave...</span>
                  </>
                ) : isDelivered ? (
                  <>
                    <span className="material-symbols-outlined text-xl">check_circle</span>
                    <span>Cryptographically Signed &amp; Delivered</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl">verified</span>
                    <span>Approve &amp; Cryptographically Sign</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  className="w-full py-2.5 px-3.5 rounded-lg text-xs font-mono font-bold text-error hover:bg-error-container/20 transition-colors flex items-center justify-center gap-2 cursor-pointer border border-error/40 disabled:opacity-50"
                  onClick={() => onReview({ decision: 'reject', approverId })}
                  disabled={isReviewing || isRejected}
                  id="btn-flag-snippet"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">flag</span>
                  <span>Reject Proposal</span>
                </button>

                <button
                  className="w-full py-2.5 px-3.5 rounded-lg text-xs font-mono font-bold text-tertiary-fixed-dim hover:bg-tertiary-container/20 transition-colors flex items-center justify-center gap-2 cursor-pointer border border-tertiary-fixed-dim/40 disabled:opacity-50"
                  onClick={() => onSimulateStaleAttack({ approverId })}
                  disabled={isReviewing || isDelivered}
                  title="Verify CE-TC3: Modifies content to prove that hash mismatch returns HTTP 409 Conflict."
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">shield_with_heart</span>
                  <span>Simulate Stale Attack (CE-TC3)</span>
                </button>
              </div>
            </div>

            {/* Success Toast Notification */}
            {isDelivered && (
              <div
                className="p-3.5 rounded-lg bg-secondary-container/20 text-secondary text-sm font-mono flex items-center justify-between border border-secondary/40"
                id="sign-success-toast"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-lg">task_alt</span>
                  <span className="font-semibold">Signed and delivered. Output hash verified.</span>
                </div>
                <span className="text-on-surface-variant font-bold">
                  {requestId ? `ID: ${requestId.slice(0, 8)}` : ''}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
