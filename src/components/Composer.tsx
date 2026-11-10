import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Transaction } from '../finance';
import { TransactionForm } from './TransactionForm';

type ComposerContextValue = {
  /** Opens the transaction sheet: pass a transaction to edit it, or starting values for a new one. */
  open: (initial?: Partial<Transaction>) => void;
};

const ComposerContext = createContext<ComposerContextValue>({ open: () => {} });

/** One transaction sheet for the whole app, so any screen (and the + button) can open it. */
export function ComposerProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [initial, setInitial] = useState<Partial<Transaction> | null>(null);

  const open = useCallback((next?: Partial<Transaction>) => {
    setInitial(next ?? null);
    setVisible(true);
  }, []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ComposerContext.Provider value={value}>
      {children}
      <TransactionForm visible={visible} initial={initial} onClose={() => setVisible(false)} />
    </ComposerContext.Provider>
  );
}

export function useComposer(): ComposerContextValue {
  return useContext(ComposerContext);
}
