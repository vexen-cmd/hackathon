import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import HistoryDrawer from './components/HistoryDrawer.jsx';
import CodeEditor, { PRESETS } from './components/CodeEditor.jsx';
import ProposalViewer from './components/ProposalViewer.jsx';
import DeliveredResult from './components/DeliveredResult.jsx';
import AuditTrail from './components/AuditTrail.jsx';
import Toast from './components/Toast.jsx';

async function safeJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { detail: 'Invalid response from server.' }; }
}

export default function App() {
  const [currentPreset, setCurrentPreset] = useState('python');
  const [code, setCode] = useState(PRESETS.python.code);
  const [activeFilename, setActiveFilename] = useState(PRESETS.python.filename);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [workflowState, setWorkflowState] = useState('ready');
  const [events, setEvents] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [finalResult, setFinalResult] = useState(null);
  const [markdown, setMarkdown] = useState('');
  const [explanation, setExplanation] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [historyRuns, setHistoryRuns] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [health, setHealth] = useState(null);
  const [isHealthy, setIsHealthy] = useState(false);
  const [toasts, setToasts] = useState([]);

  const toast = (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, message, type }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5000);
  };
  const refreshHealth = async () => {
    try { const response = await fetch('/api/health'); const data = await safeJson(response); setHealth(data); setIsHealthy(response.ok && data.status === 'ok'); }
    catch { setIsHealthy(false); }
  };
  useEffect(() => { refreshHealth(); const timer = setInterval(refreshHealth, 15000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); analyze(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); newChat(); }
    };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  });
  const selectPreset = (key) => { const next = PRESETS[key]; if (!next) return; setCurrentPreset(key); setCode(next.code); setActiveFilename(next.filename); };
  const selectRun = (run) => {
    setRequestId(run.requestId); setCode(run.code); setActiveFilename(run.name); setProposal(run.proposal); setExplanation(run.proposal?.explanation || ''); setDocumentation(run.proposal?.documentation || ''); setWorkflowState(run.status); setEvents(run.events || []); setEvidence(run.evidence || []); setFinalResult(run.finalResult || null); setMarkdown(run.markdown || ''); setDrawerOpen(false);
  };
  const newChat = () => {
    setRequestId(null); setProposal(null); setWorkflowState('ready'); setEvents([]); setEvidence([]); setFinalResult(null); setMarkdown(''); setExplanation(''); setDocumentation(''); setCode(''); setActiveFilename('snippet.py'); setDrawerOpen(false);
    toast('New chat started.', 'info');
  };
  const analyze = async () => {
    if (!code.trim() || isAnalyzing) return;
    setIsAnalyzing(true); setWorkflowState('analyzing'); setFinalResult(null); setMarkdown('');
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, source_id: `snippet-${Date.now()}` }) });
      const data = await safeJson(response); if (!response.ok) throw new Error(data.detail || data.error || 'Analysis failed.');
      setRequestId(data.request_id); setProposal(data.proposal); setExplanation(data.proposal?.explanation || ''); setDocumentation(data.proposal?.documentation || ''); setWorkflowState(data.state || 'awaiting_review'); setEvents(data.events || []); setEvidence(data.evidence || []);
      setHistoryRuns((runs) => [{ requestId: data.request_id, name: activeFilename, language: data.proposal?.language?.name, status: data.state || 'awaiting_review', outputHash: data.proposal?.output_hash, time: new Date().toLocaleTimeString(), code, proposal: data.proposal, events: data.events || [], evidence: data.evidence || [] }, ...runs]);
      toast('Snippet analyzed. Review the generated README before delivery.', 'success');
    } catch (error) { setWorkflowState('failed'); toast(error.message || 'Could not reach the harness.', 'error'); }
    finally { setIsAnalyzing(false); }
  };
  const review = async ({ decision, approverId }) => {
    if (!requestId || isReviewing) return;
    setIsReviewing(true);
    try {
      const response = await fetch(`/api/${requestId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approver_id: approverId || 'local-reviewer', decision, edited_explanation: null, edited_documentation: null }) });
      const data = await safeJson(response); if (!response.ok) throw new Error(data.detail || data.error || 'Review failed.');
      setEvents(data.events || []);
      if (decision === 'reject') { setWorkflowState('rejected'); toast('Proposal rejected. Delivery halted.', 'warning'); return; }
      const formatResponse = await fetch(`/api/${requestId}/format`, { method: 'POST' }); const formatted = await safeJson(formatResponse);
      if (!formatResponse.ok) throw new Error(formatted.detail || formatted.error || 'Formatting failed.');
      setFinalResult(formatted.final_result); setMarkdown(formatted.markdown || ''); setWorkflowState('delivered'); toast('README.md approved and delivered.', 'success');
    } catch (error) { toast(error.message || 'Review could not be completed.', 'error'); }
    finally { setIsReviewing(false); }
  };
  const staleAttack = async ({ approverId }) => {
    if (!requestId) return toast('Analyze a snippet first.', 'warning');
    setIsReviewing(true);
    try {
      const response = await fetch(`/api/${requestId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approver_id: approverId || 'local-reviewer', decision: 'approve', edited_explanation: `${explanation} [modified]`, edited_documentation: documentation }) });
      toast(response.status === 409 ? 'CE-TC3 passed: stale approval was rejected.' : 'Stale approval test did not return the expected conflict.', response.status === 409 ? 'success' : 'warning');
    } catch (error) { toast(error.message, 'error'); } finally { setIsReviewing(false); }
  };
  const audit = () => document.getElementById('audit-ledger-section')?.scrollIntoView({ behavior: 'smooth' });

  return <div className="bg-background min-h-screen font-sans text-on-surface antialiased">
    <Navbar health={health} isHealthy={isHealthy} onToggleDrawer={() => setDrawerOpen(!drawerOpen)} onScrollToAudit={audit} />
    <HistoryDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} historyRuns={historyRuns} onSelectRun={selectRun} onNewChat={newChat} currentRequestId={requestId} workflowState={workflowState} />
    <main className="dashboard-main pl-0 lg:pl-80 min-h-screen bg-background pt-20 px-5 lg:px-8"><div className="dashboard-content w-full pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"><div><div className="flex items-center gap-2 mb-2"><span className="text-xs font-mono font-bold text-primary px-2.5 py-1 rounded bg-surface-container-high border border-primary/25">ENCLAVE HARNESS</span><span className="text-xs font-mono text-on-surface-variant">{requestId ? `SESSION: ${requestId.slice(0, 12)}` : 'SESSION: Awaiting submission'}</span></div><h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Zero-Trust Snippet Explainer</h1></div><div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container border border-outline-variant/30 text-xs font-mono"><span className={isHealthy ? 'text-secondary' : 'text-error'}>●</span>{isHealthy ? 'Ollama connected' : 'Engine offline'}<span className="text-outline">/</span><span className="text-primary uppercase">{workflowState}</span></div></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-6">
        <div className="h-full flex flex-col min-h-0">
          <CodeEditor
            code={code}
            setCode={setCode}
            onAnalyze={analyze}
            isAnalyzing={isAnalyzing}
            currentPreset={currentPreset}
            onSelectPreset={selectPreset}
            activeFilename={activeFilename}
            setActiveFilename={setActiveFilename}
          />
        </div>
        <div className="h-full flex flex-col min-h-0">
          <ProposalViewer
            proposal={proposal}
            workflowState={workflowState}
            requestId={requestId}
            onReview={review}
            onSimulateStaleAttack={staleAttack}
            isReviewing={isReviewing}
            explanation={explanation}
            setExplanation={setExplanation}
            documentation={documentation}
            setDocumentation={setDocumentation}
            evidence={evidence}
          />
        </div>
      </div>
      {finalResult && <DeliveredResult finalResult={finalResult} markdown={markdown} />}
      <AuditTrail events={events} evidence={evidence} />
    </div></main><Toast toasts={toasts} onDismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
  </div>;
}
