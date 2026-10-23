import React, { useState } from 'react';

export default function AuditTrail({ events = [], evidence = [] }) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('events'); // 'events' | 'evidence'

  const untrustedItems = evidence.filter((e) => e.trust === 'untrusted');
  const hasInjection = untrustedItems.some((e) => e.extracted?.matched_phrase);

  return (
    <div
      className="mt-6 w-full bg-surface-container-low rounded-xl shadow-xl overflow-hidden border border-outline-variant/30 scroll-mt-20"
      id="audit-ledger-section"
    >
      {/* Collapsible Header Accordion */}
      <button
        className="w-full px-5 py-4 bg-surface-container flex items-center justify-between text-left hover:bg-surface-container-high transition-colors cursor-pointer border-b border-outline-variant/30"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="flex items-center gap-3.5">
          <span className="p-2 rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-xl">receipt_long</span>
          </span>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-base font-bold text-on-surface">
              Audit Trail &amp; Evidence Ledger
            </span>
            <span className="px-2.5 py-1 rounded-full bg-secondary-container/20 text-secondary text-xs font-mono font-bold border border-secondary/35">
              {events.length} Event{events.length === 1 ? '' : 's'}
            </span>
            {evidence.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-primary-container/20 text-primary text-xs font-mono font-bold border border-primary/35">
                {evidence.length} Evidence Record{evidence.length === 1 ? '' : 's'}
              </span>
            )}
            {hasInjection && (
              <span className="px-2.5 py-1 rounded-full bg-error-container/25 text-error text-xs font-mono font-bold border border-error/45 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">shield_alert</span>
                CE-TC4 Prompt Injection Isolated
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-on-surface-variant font-medium hidden sm:inline">
            Status: {events.length > 0 ? `${events.length} Recorded` : 'Standing By'}
          </span>
          <span
            className="material-symbols-outlined text-on-surface-variant text-2xl transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
          >
            expand_more
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col">
          {/* Sub-tabs for Audit Events vs CE-TC4 Evidence */}
          <div className="px-5 py-2.5 bg-surface-container-lowest flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('events')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                  activeTab === 'events'
                    ? 'bg-surface-container-high text-primary font-bold border border-primary/40'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                State Transitions ({events.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('evidence')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'evidence'
                    ? 'bg-surface-container-high text-primary font-bold border border-primary/40'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>CE-TC4 Evidence Isolation ({evidence.length})</span>
                {hasInjection && <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>}
              </button>
            </div>

            <div className="text-outline text-xs font-mono hidden md:block">
              {events.length > 0 ? 'Tamper-Evident State Sequence' : 'Awaiting Workflow Execution'}
            </div>
          </div>

          {activeTab === 'events' ? (
            /* Events Table */
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left font-mono text-sm">
                <thead>
                  <tr className="bg-surface-container-lowest text-outline text-xs font-mono font-bold uppercase tracking-wider border-b border-surface-container-high">
                    <th className="py-3 px-5">Seq</th>
                    <th className="py-3 px-5">Timestamp</th>
                    <th className="py-3 px-5">State Transition</th>
                    <th className="py-3 px-5">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/50 text-on-surface-variant">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-outline font-sans text-sm">
                        <span className="material-symbols-outlined text-3xl mb-2 text-outline/50 block">receipt_long</span>
                        No state transitions recorded yet.
                        <p className="mt-1 text-xs text-outline/70">
                          Submit a code snippet to view real-time state machine transitions and hashes.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    events.map((event, index) => {
                      const timeStr = event.at
                        ? new Date(event.at).toLocaleTimeString()
                        : '—';
                      const seqNum = event.seq !== undefined ? event.seq : index + 1;
                      const isRejected = event.state === 'rejected';

                      return (
                        <tr
                          key={index}
                          className="hover:bg-surface-container/40 transition-colors"
                        >
                          <td className="py-3.5 px-5 font-bold text-outline text-xs">
                            #{String(seqNum).padStart(2, '0')}
                          </td>
                          <td className="py-3.5 px-5 text-on-surface whitespace-nowrap text-xs">
                            {timeStr}
                          </td>
                          <td className="py-3.5 px-5">
                            <span
                              className={`px-2.5 py-1 rounded font-bold text-xs uppercase ${
                                isRejected
                                  ? 'bg-error-container/25 text-error border border-error/45'
                                  : 'bg-surface-container text-primary border border-primary/25'
                              }`}
                            >
                              {event.state || 'EVENT'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-xs font-mono">
                            {event.detail && Object.keys(event.detail).length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(event.detail).map(([k, v]) => (
                                  <span key={k} className="bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant/30">
                                    <span className="text-outline">{k}:</span>{' '}
                                    <span className="text-on-surface font-semibold">
                                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : event.hash ? (
                              <span className="text-outline">hash: {event.hash.slice(0, 16)}...</span>
                            ) : (
                              <span className="text-outline">Session state updated</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* CE-TC4 Evidence Table */
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left font-mono text-sm">
                <thead>
                  <tr className="bg-surface-container-lowest text-outline text-xs font-mono font-bold uppercase tracking-wider border-b border-surface-container-high">
                    <th className="py-3 px-5">Extracted At</th>
                    <th className="py-3 px-5">Trust Level</th>
                    <th className="py-3 px-5">Extracted Payload</th>
                    <th className="py-3 px-5">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/50 text-on-surface-variant">
                  {evidence.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-outline font-sans text-sm">
                        <span className="material-symbols-outlined text-3xl mb-2 text-outline/50 block">shield</span>
                        No evidence records in current session.
                        <p className="mt-1 text-xs text-outline/70">
                          Comments and strings from snippets are isolated into this ledger as untrusted data.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    evidence.map((item, index) => {
                      const isUntrusted = item.trust === 'untrusted';
                      const matched = item.extracted?.matched_phrase;
                      return (
                        <tr
                          key={index}
                          className={`hover:bg-surface-container/40 transition-colors ${
                            matched ? 'bg-error-container/10' : ''
                          }`}
                        >
                          <td className="py-3.5 px-5 text-on-surface whitespace-nowrap text-xs">
                            {item.retrieved_at ? new Date(item.retrieved_at).toLocaleTimeString() : '—'}
                          </td>
                          <td className="py-3.5 px-5">
                            <span
                              className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${
                                isUntrusted
                                  ? 'bg-error-container/25 text-error border border-error/40'
                                  : 'bg-secondary-container/20 text-secondary border border-secondary/40'
                              }`}
                            >
                              {item.trust}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 max-w-sm truncate text-xs">
                            {matched ? (
                              <span className="text-error font-bold">{matched}</span>
                            ) : item.extracted && Object.keys(item.extracted).length > 0 ? (
                              JSON.stringify(item.extracted)
                            ) : (
                              'AST token content'
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-xs text-on-surface-variant">
                            {item.note || 'Recorded evidence'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
