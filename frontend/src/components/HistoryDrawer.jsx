import React, { useState } from 'react';

export default function HistoryDrawer({
  isOpen,
  onClose,
  historyRuns = [],
  onSelectRun,
  onNewChat,
  currentRequestId,
  workflowState = 'ready',
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRuns = historyRuns.filter(
    (item) =>
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.status?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.requestId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.outputHash?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/70 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      <aside
        className={`fixed left-0 top-16 bottom-0 w-80 bg-surface-container-lowest z-40 flex flex-col shadow-[6px_0_28px_rgba(0,0,0,0.6)] border-r border-outline-variant/30 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        id="history-drawer"
      >
        <div className="p-4 flex flex-col gap-3 border-b border-outline-variant/20">
          <button
            type="button"
            onClick={onNewChat}
            className="w-full h-11 px-3 rounded-lg border border-outline-variant/50 bg-surface-container-low text-on-surface text-sm font-semibold flex items-center gap-2.5 text-left hover:bg-surface-container hover:border-primary/50 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            New chat
          </button>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant">
              Snippet Audit History
            </span>
            <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-surface-container border border-primary/25">
              {historyRuns.length} RUN{historyRuns.length === 1 ? '' : 'S'}
            </span>
          </div>
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">
              search
            </span>
            <input
              className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-low text-on-surface text-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] border border-outline-variant/40"
              placeholder="Search session runs..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="px-4 py-2.5 flex items-center justify-between bg-surface-container-lowest border-b border-outline-variant/10">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-outline">
            Session History
          </span>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-surface-container text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1.5 py-2">
          {historyRuns.length === 0 ? (
            <div className="py-12 px-4 text-center text-outline font-mono text-xs leading-relaxed">
              <span className="material-symbols-outlined text-3xl mb-2 text-outline/50 block">history</span>
              No audit runs in this session yet.
              <p className="mt-1 text-[11px] text-outline/70">
                Analyze a code snippet to record cryptographic runs in the enclave ledger.
              </p>
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="py-8 text-center text-outline font-mono text-xs">
              No matching runs found.
            </div>
          ) : (
            filteredRuns.map((item, idx) => {
              const isActive = currentRequestId === item.requestId;
              const isApproved = item.status === 'approved' || item.status === 'delivered';
              const isRejected = item.status === 'rejected';

              const statusColor = isApproved
                ? 'text-secondary bg-secondary-container/20 border-secondary/40'
                : isRejected
                ? 'text-error bg-error-container/25 border-error/50'
                : 'text-tertiary-fixed-dim bg-tertiary-container/20 border-tertiary-fixed-dim/40';

              return (
                <button
                  key={item.requestId || idx}
                  type="button"
                  onClick={() => {
                    if (onSelectRun) onSelectRun(item);
                  }}
                  className={`w-full text-left group flex flex-col p-3 rounded-xl transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-surface-container-high border-primary/50 text-on-surface shadow-md'
                      : 'border-outline-variant/20 hover:bg-surface-container text-on-surface-variant hover:border-outline-variant/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span
                      className={`font-mono text-sm font-semibold truncate ${
                        isActive ? 'text-primary' : 'text-on-surface'
                      }`}
                    >
                      {item.name || `run-${item.requestId?.slice(0, 8)}`}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 uppercase ${statusColor}`}
                    >
                      {item.status || 'Analyzed'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-on-surface-variant font-mono text-xs">
                    <span className="truncate">
                      {item.language ? `${item.language} • ` : ''}
                      {item.outputHash ? `${item.outputHash.slice(0, 10)}...` : item.requestId?.slice(0, 10)}
                    </span>
                    <span className="text-outline shrink-0 ml-2">{item.time}</span>
                  </div>
                </button>
              );
            })
          )}
        </nav>

        <div className="p-4 bg-surface-container-low/60 border-t border-outline-variant/30">
          <div className="flex items-center justify-between text-on-surface-variant font-mono text-xs font-medium mb-1.5">
            <span>Workflow Status</span>
            <span className="text-primary font-bold uppercase">{workflowState}</span>
          </div>
          <div className="flex items-center justify-between text-on-surface-variant font-mono text-xs">
            <span>Enclave Runs</span>
            <span className="text-secondary font-bold">{historyRuns.length} Recorded</span>
          </div>
        </div>
      </aside>
    </>
  );
}
