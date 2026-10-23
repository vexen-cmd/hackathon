import React from 'react';

export default function Toast({ toasts = [], onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-xl backdrop-blur-xl shadow-2xl flex items-start gap-3 border text-xs font-mono toast-animate ${
              isSuccess
                ? 'bg-surface-container-high/95 text-secondary border-secondary/40 shadow-[0_0_20px_rgba(5,231,119,0.2)]'
                : isError
                ? 'bg-surface-container-high/95 text-error border-error/40 shadow-[0_0_20px_rgba(255,180,171,0.2)]'
                : isWarning
                ? 'bg-surface-container-high/95 text-tertiary-fixed-dim border-tertiary-fixed-dim/40 shadow-[0_0_20px_rgba(255,186,56,0.2)]'
                : 'bg-surface-container-high/95 text-primary border-primary/40 shadow-[0_0_20px_rgba(0,229,255,0.2)]'
            }`}
          >
            <span className="material-symbols-outlined text-base mt-0.5 shrink-0">
              {isSuccess
                ? 'check_circle'
                : isError
                ? 'error'
                : isWarning
                ? 'warning'
                : 'info'}
            </span>

            <div className="flex-1 text-on-surface leading-relaxed break-words">
              {t.message}
            </div>

            <button
              onClick={() => onDismiss(t.id)}
              className="text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer shrink-0 transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
