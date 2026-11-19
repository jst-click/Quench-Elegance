import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

/* ---------------- Confirm dialog (replaces window.confirm) ---------------- */
const ConfirmCtx = createContext(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setDialog(typeof opts === 'string' ? { title: opts } : opts);
      }),
    []
  );
  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  };

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}

        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex max-w-md animate-fade-up items-center gap-2.5 rounded-full px-5 py-3 text-sm text-white shadow-lift ${t.type === 'error' ? 'bg-danger' : 'bg-brown-900'}`}
            >
              {t.type === 'error' ? <XCircle size={17} className="shrink-0" /> : <CheckCircle2 size={17} className="shrink-0 text-gold-soft" />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>

        {dialog && (
          <Modal onClose={() => close(false)} size="sm">
            <div className="flex gap-4">
              <span className={`grid size-11 shrink-0 place-items-center rounded-full ${dialog.danger ? 'bg-danger/10 text-danger' : 'bg-cream text-brown-800'}`}>
                <AlertTriangle size={20} />
              </span>
              <div>
                <h2 className="text-2xl">{dialog.title}</h2>
                {dialog.body && <p className="mt-1.5 text-sm text-muted">{dialog.body}</p>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => close(false)}>Cancel</button>
              <button autoFocus className={dialog.danger ? 'btn bg-danger text-white hover:brightness-110' : 'btn-primary'} onClick={() => close(true)}>
                {dialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </Modal>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ title, subtitle, onClose, children, size = 'md' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-brown-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative max-h-[92vh] w-full ${width} animate-pop overflow-y-auto rounded-t-3xl bg-[#fbfaf9] p-6 shadow-lift sm:rounded-3xl sm:p-7`}>
        {title && (
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[28px] leading-tight">{title}</h2>
              {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
            </div>
            <button type="button" className="icon-btn -mr-2 -mt-1" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
