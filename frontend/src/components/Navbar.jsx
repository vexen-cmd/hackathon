import React, { useState } from 'react';

export default function Navbar({ health, isHealthy, onToggleDrawer, onScrollToAudit }) {
  const [showDocsModal, setShowDocsModal] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.5)] border-b border-outline-variant/30">
        <div className="h-16 w-full px-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              aria-label="Toggle History Drawer"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              onClick={onToggleDrawer}
              type="button"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-secondary-container to-primary-container flex items-center justify-center shadow-[0_0_16px_rgba(0,229,255,0.35)]">
                <span className="material-symbols-outlined text-on-primary font-bold text-xl">shield</span>
              </div>
              <span className="text-xl font-bold text-on-surface tracking-tight hidden sm:inline-block">
                Snippet Studio
              </span>
            </div>
            <div className="flex items-center px-3 py-1 rounded-full bg-surface-container border border-primary/25 shadow-[0_0_12px_rgba(0,229,255,0.2)]">
              <span className="text-xs font-mono font-bold text-primary tracking-widest">SAFETY-FIRST</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface-container-low shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)] border border-outline-variant/30">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                    isHealthy ? 'bg-secondary-container opacity-75' : 'bg-error-container opacity-75'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isHealthy ? 'bg-secondary' : 'bg-error'
                  }`}
                ></span>
              </span>
              <span className="text-sm font-mono text-on-surface font-medium hidden md:inline-block">
                {isHealthy
                  ? health?.ollama_host
                    ? `Engine: ${health.ollama_host}`
                    : 'Harness API Connected'
                  : 'Engine Offline'}
              </span>
            </div>

            <nav className="hidden sm:flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowDocsModal(true)}
                className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors cursor-pointer px-2 py-1 rounded"
              >
                Docs
              </button>
              <button
                type="button"
                onClick={onScrollToAudit}
                className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors cursor-pointer px-2 py-1 rounded"
              >
                Audit Log
              </button>
            </nav>

            <div className="relative flex items-center pl-1">
              <div className="w-9 h-9 rounded-full bg-surface-container-high ring-2 ring-primary/40 flex items-center justify-center font-mono text-sm text-primary font-bold overflow-hidden shadow-md">
                <span className="material-symbols-outlined text-lg">person</span>
              </div>
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-surface-container-lowest ${
                  isHealthy ? 'bg-secondary-container' : 'bg-outline'
                }`}
                title={isHealthy ? 'Cryptographic Key Active' : 'Offline'}
              ></span>
            </div>
          </div>
        </div>
      </header>

      {/* Architecture & Docs Modal */}
      {showDocsModal && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowDocsModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-surface-container-low border border-outline-variant/40 rounded-2xl p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
                <h3 className="text-xl font-bold text-on-surface">Zero-Trust Enclave Safety Architecture</h3>
              </div>
              <button
                onClick={() => setShowDocsModal(false)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-4 text-sm font-mono text-on-surface-variant leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
              <div className="p-4 rounded-xl bg-surface-container border border-primary/20">
                <span className="text-primary font-bold text-base block mb-1">1. Zero-Trust Execution Boundary</span>
                <p className="text-on-surface text-sm">
                  Code inputs are treated strictly as untrusted data. AST tokenization isolates comment payloads, preventing any untrusted input from acting as executable instructions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-container border border-secondary/20">
                <span className="text-secondary font-bold text-base block mb-1">2. CE-TC3 Cryptographic Output Binding</span>
                <p className="text-on-surface text-sm">
                  Attestation binds mathematically to the canonical SHA-256 hash of the exact explanation and documentation. Modifying any character after attestation triggers HTTP 409 Conflict.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-container border border-tertiary-fixed-dim/20">
                <span className="text-tertiary-fixed-dim font-bold text-base block mb-1">3. CE-TC4 Adversarial Prompt Injection Isolation</span>
                <p className="text-on-surface text-sm">
                  Jailbreak patterns (e.g. system overrides, DAN commands) are quarantined into the untrusted evidence ledger. Proposals remain strictly quarantined until human attestation.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/40">
                <span className="text-on-surface font-bold text-base block mb-1">4. Tamper-Evident Event Chain</span>
                <p className="text-on-surface text-sm">
                  Every pipeline step (Tokenize, Infer, Propose, Attest, Deliver) produces a Merkle hash chain. Before final delivery, the full cryptographic chain is verified.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowDocsModal(false)}
                className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-container font-bold text-sm hover:shadow-[0_0_15px_rgba(0,229,255,0.4)] transition-all cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
