import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import CodeEditor from './components/CodeEditor.jsx';
import ProposalViewer from './components/ProposalViewer.jsx';
import DeliveredResult from './components/DeliveredResult.jsx';
import AuditTrail from './components/AuditTrail.jsx';
import EvidenceLedger from './components/EvidenceLedger.jsx';
import Toast from './components/Toast.jsx';

// Safe JSON parser to prevent 'Unexpected end of JSON input' on empty or non-JSON responses
async function safeJson(response) {
  try {
    const text = await response.text();
    if (!text || !text.trim()) {
      return {};
    }
    return JSON.parse(text);
  } catch (err) {
    return { error: 'Invalid response from server.', detail: err.message };
  }
}

export default function App() {
  const [code, setCode] = useState(`def calculate_discount(price: float, discount_percent: float) -> float:
    """Calculates the discounted price with validation."""
    if not 0 <= discount_percent <= 100:
        raise ValueError("Discount must be between 0 and 100")
    discount_amount = price * (discount_percent / 100)
    return round(price - discount_amount, 2)
`);
  const [requestId, setRequestId] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [originalProposal, setOriginalProposal] = useState(null);
  const [workflowState, setWorkflowState] = useState('ready');
  const [events, setEvents] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [finalResult, setFinalResult] = useState(null);
  const [markdown, setMarkdown] = useState('');

  const [explanation, setExplanation] = useState('');
  const [documentation, setDocumentation] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [health, setHealth] = useState(null);
  const [isHealthy, setIsHealthy] = useState(false);

  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Check health on mount
  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await safeJson(res);
        setHealth(data);
        setIsHealthy(true);
      } else {
        setIsHealthy(false);
      }
    } catch {
      setIsHealthy(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Analyze code snippet
  const handleAnalyze = async () => {
    if (!code.trim()) {
      addToast('Please enter or select a code snippet first.', 'warning');
      return;
    }

    setIsAnalyzing(true);
    setFinalResult(null);
    setMarkdown('');
    setWorkflowState('analyzing');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          source_id: `snippet-${Date.now()}`,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.error || data.detail || `Analysis failed (${res.status})`);
      }

      setRequestId(data.request_id);
      setProposal(data.proposal);
      setOriginalProposal(data.proposal);
      setExplanation(data.proposal?.explanation || '');
      setDocumentation(data.proposal?.documentation || '');
      setWorkflowState(data.state || 'awaiting_review');
      setEvents(data.events || []);
      setEvidence(data.evidence || []);

      addToast('Snippet analyzed! Awaiting human review.', 'success');
    } catch (err) {
      setWorkflowState('failed');
      addToast(err.message || 'Error communicating with analysis service.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit Review Decision
  const handleReview = async ({ decision, approverId }) => {
    if (!requestId) return;

    setIsReviewing(true);
    try {
      if (decision === 'reject') {
        const res = await fetch(`/api/${requestId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approver_id: approverId,
            decision: 'reject',
          }),
        });

        const data = await safeJson(res);
        if (!res.ok) {
          throw new Error(data.error || data.detail || `Rejection failed (${res.status})`);
        }

        setWorkflowState('rejected');
        setEvents(data.events || []);
        addToast('Proposal rejected. Delivery halted.', 'warning');
      } else {
        // Legitimate Approval
        // Pass review decision
        const reviewRes = await fetch(`/api/${requestId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approver_id: approverId,
            decision: 'approve',
            edited_explanation: null,
            edited_documentation: null,
          }),
        });

        const reviewData = await safeJson(reviewRes);
        if (!reviewRes.ok) {
          throw new Error(reviewData.error || reviewData.detail || `Approval failed (${reviewRes.status})`);
        }

        setEvents(reviewData.events || []);

        // Step 2: Format & Deliver Markdown
        const formatRes = await fetch(`/api/${requestId}/format`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const formatData = await safeJson(formatRes);
        if (!formatRes.ok) {
          throw new Error(formatData.error || formatData.detail || `Format failed (${formatRes.status})`);
        }

        setMarkdown(formatData.markdown || formatData.final_result?.formatted_markdown || '');
        setFinalResult(formatData.final_result);
        setWorkflowState('delivered');

        // Refresh session to get updated events
        try {
          const sessionRes = await fetch(`/api/${requestId}`);
          if (sessionRes.ok) {
            const sessionData = await safeJson(sessionRes);
            setEvents(sessionData.events || []);
          }
        } catch {
          // ignore
        }

        addToast('Proposal approved! Markdown delivered and event chain verified.', 'success');
      }
    } catch (err) {
      addToast(err.message || 'Failed to complete review.', 'error');
    } finally {
      setIsReviewing(false);
    }
  };

  // Simulate Stale Edit Attack (CE-TC3 test)
  const handleSimulateStaleAttack = async ({ approverId }) => {
    if (!requestId) return;

    setIsReviewing(true);
    try {
      const res = await fetch(`/api/${requestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approver_id: approverId,
          decision: 'approve',
          edited_explanation: (explanation || '') + ' [MODIFIED_AFTER_HASH]',
          edited_documentation: documentation,
        }),
      });

      const data = await safeJson(res);
      if (res.status === 409) {
        addToast(
          'CE-TC3 PASSED: Server returned HTTP 409 Conflict! Stale approval rejected because content changed after hash creation.',
          'success'
        );
      } else if (!res.ok) {
        addToast(`Server response (${res.status}): ${data.detail || data.error}`, 'warning');
      } else {
        addToast('Unexpected: server accepted modified approval.', 'warning');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar health={health} isHealthy={isHealthy} />

      {/* Safety Notice Banner */}
      <aside className="safety-banner">
        <div className="safety-banner-left">
          <span className="banner-pill">SAFETY-FIRST HARNESS</span>
          <span>
            Code is treated strictly as data and never executed. Output requires cryptographically bound human approval.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>CE-TC3 &amp; CE-TC4 Protected</span>
          <span style={{ opacity: 0.7 }}>·</span>
          <span>Local Qwen 1.5B</span>
        </div>
      </aside>

      {/* Main Workbench Layout */}
      <main className="main-content">
        <div className="grid-workbench">
          {/* Panel 1: Source Code Editor */}
          <CodeEditor
            code={code}
            setCode={setCode}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
          />

          {/* Panel 2: Proposal & Review */}
          <ProposalViewer
            proposal={proposal}
            workflowState={workflowState}
            requestId={requestId}
            onReview={handleReview}
            onSimulateStaleAttack={handleSimulateStaleAttack}
            isReviewing={isReviewing}
            explanation={explanation}
            setExplanation={setExplanation}
            documentation={documentation}
            setDocumentation={setDocumentation}
          />
        </div>

        {/* Panel 3: Delivered Documentation (Shown when approved/delivered) */}
        {finalResult && (
          <DeliveredResult finalResult={finalResult} markdown={markdown} />
        )}

        {/* Bottom Grid: Audit Trail & Evidence Ledger */}
        <div className="bottom-grid">
          <AuditTrail events={events} />
          <EvidenceLedger evidence={evidence} />
        </div>
      </main>

      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
