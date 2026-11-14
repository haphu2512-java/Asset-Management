import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastInput = {
  message: string;
  tone?: 'success' | 'warning' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
};
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<{ show: (toast: ToastInput) => void }>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (toast: ToastInput) => {
      const id = next.current++;
      setItems((list) => [...list.slice(-2), { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.onAction ? 6000 : 3500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone ?? ''}`}>
            <span>{t.message}</span>
            {t.onAction ? (
              <button
                onClick={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
              >
                {t.actionLabel ?? 'Hoàn tác'}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
