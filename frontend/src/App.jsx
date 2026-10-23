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
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) fetchUser(token);
    else fetchHistory();
    refreshHealth();
  }, []);

  const fetchUser = async (token) => {
    try {
      const response = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await safeJson(response);
        setUser(data);
        fetchHistory(token);
      } else {
        localStorage.removeItem('auth_token');
        fetchHistory();
      }
    } catch {
      localStorage.removeItem('auth_token');
      fetchHistory();
    }
  };

  const fetchHistory = async (token) => {
    try {
      const response = await fetch('/api/history', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const data = await safeJson(response);
      if (Array.isArray(data)) {
        setHistoryRuns(data.map(r => ({
          requestId: r.request_id,
          name: r.source_id,
          language: r.language_name,
          status: r.state,
          outputHash: r.output_hash,
          time: new Date(r.created_at).toLocaleTimeString(),
        })));
      }
    } catch (e) { console.error('Failed to fetch history', e); }
  };

  const toast = (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, message, type }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5000);
  };
  const refreshHealth = async () => {
    try { const response = await fetch('/api/health'); const data = await safeJson(response); setHealth(data); setIsHealthy(response.ok && data.status === 'ok'); }
    catch { setIsHealthy(false); }
  };
  useEffect(() => { const timer = setInterval(refreshHealth, 15000); return () => clearInterval(timer); }, []);

  const selectPreset = (key) => { const next = PRESETS[key]; if (!next) return; setCurrentPreset(key); setCode(next.code); setActiveFilename(next.filename); };
  const selectRun = async (run) => {
    const token = localStorage.getItem('auth_token');
    try {
      const response = await fetch(`/api/${run.requestId}`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const data = await safeJson(response);
      setRequestId(data.request_id); setCode(data.snippet?.code || ''); setActiveFilename(run.name); setProposal(data.proposal); setExplanation(data.proposal?.explanation || ''); setDocumentation(data.proposal?.documentation || ''); setWorkflowState(data.state); setEvents(data.events || []); setEvidence(data.evidence || []); setFinalResult(data.final_result || null); setMarkdown(data.final_result?.formatted_markdown || ''); setDrawerOpen(false);
    } catch (e) { toast('Could not load session', 'error'); }
  };
  const newChat = () => {
    setRequestId(null); setProposal(null); setWorkflowState('ready'); setEvents([]); setEvidence([]); setFinalResult(null); setMarkdown(''); setExplanation(''); setDocumentation(''); setCode(''); setActiveFilename('snippet.py'); setDrawerOpen(false);
    toast('New chat started.', 'info');
  };

  const handleLogin = async (email, password) => {
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await safeJson(response); if (!response.ok) throw new Error(data.detail);
    localStorage.setItem('auth_token', data.token);
    setUser(data);
    fetchHistory(data.token);
    toast('Logged in successfully', 'success');
  };
  const handleRegister = async (email, password, displayName) => {
    const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, display_name: displayName }) });
    const data = await safeJson(response); if (!response.ok) throw new Error(data.detail);
    localStorage.setItem('auth_token', data.token);
    setUser(data);
    fetchHistory(data.token);
    toast('Account created', 'success');
  };
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setHistoryRuns([]);
    newChat();
    toast('Logged out', 'info');
  };

  const analyze = async () => {
    if (!code.trim() || isAnalyzing) return;
    setIsAnalyzing(true); setWorkflowState('analyzing'); setFinalResult(null); setMarkdown('');
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }, body: JSON.stringify({ code, source_id: `snippet-${Date.now()}` }) });
      const data = await safeJson(response); if (!response.ok) throw new Error(data.detail || data.error || 'Analysis failed.');
      setRequestId(data.request_id); setProposal(data.proposal); setExplanation(data.proposal?.explanation || ''); setDocumentation(data.proposal?.documentation || ''); setWorkflowState(data.state || 'awaiting_review'); setEvents(data.events || []); setEvidence(data.evidence || []);
      fetchHistory(token);
      toast('Snippet analyzed.', 'success');
    } catch (error) { setWorkflowState('failed'); toast(error.message || 'Could not reach the harness.', 'error'); }
    finally { setIsAnalyzing(false); }
  };
  const review = async ({ decision, approverId }) => {
    if (!requestId || isReviewing) return;
    setIsReviewing(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/${requestId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) }, body: JSON.stringify({ approver_id: approverId || 'local-reviewer', decision, edited_explanation: null, edited_documentation: null }) });
      const data = await safeJson(response); if (!response.ok) throw new Error(data.detail || data.error || 'Review failed.');
      setEvents(data.events || []);
      if (decision === 'reject') { setWorkflowState('rejected'); fetchHistory(token); toast('Proposal rejected.', 'warning'); return; }
      const formatResponse = await fetch(`/api/${requestId}/format`, { method: 'POST', headers: { ...(token && { 'Authorization': `Bearer ${token}` }) } }); const formatted = await safeJson(formatResponse);
      if (!formatResponse.ok) throw new Error(formatted.detail || formatted.error || 'Formatting failed.');
      setFinalResult(formatted.final_result); setMarkdown(formatted.markdown || ''); setWorkflowState('delivered'); fetchHistory(token); toast('README.md delivered.', 'success');
    } catch (error) { toast(error.message || 'Review could not be completed.', 'error'); }
    finally { setIsReviewing(false); }
  };
  const audit = () => document.getElementById('audit-ledger-section')?.scrollIntoView({ behavior: 'smooth' });

  return <div className="bg-background min-h-screen font-sans text-on-surface antialiased">
    <Navbar health={health} isHealthy={isHealthy} onToggleDrawer={() => setDrawerOpen(!drawerOpen)} onScrollToAudit={audit} user={user} onLogin={handleLogin} onLogout={handleLogout} onRegister={handleRegister} />
    <HistoryDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} historyRuns={historyRuns} onSelectRun={selectRun} onNewChat={newChat} currentRequestId={requestId} workflowState={workflowState} />
    <main className="dashboard-main pl-0 lg:pl-80 min-h-screen bg-background pt-20 px-5 lg:px-8"><div className="dashboard-content w-full pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-6">
        <div className="h-full flex flex-col min-h-0">
          <CodeEditor code={code} setCode={setCode} onAnalyze={analyze} isAnalyzing={isAnalyzing} currentPreset={currentPreset} onSelectPreset={selectPreset} activeFilename={activeFilename} setActiveFilename={setActiveFilename} />
        </div>
        <div className="h-full flex flex-col min-h-0">
          <ProposalViewer proposal={proposal} workflowState={workflowState} requestId={requestId} onReview={review} isReviewing={isReviewing} explanation={explanation} setExplanation={setExplanation} documentation={documentation} setDocumentation={setDocumentation} evidence={evidence} />
        </div>
      </div>
      {finalResult && <DeliveredResult finalResult={finalResult} markdown={markdown} />}
      <AuditTrail events={events} evidence={evidence} />
    </div></main><Toast toasts={toasts} onDismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
  </div>;
}