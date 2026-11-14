import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Transaction } from '@shared/finance';
import { TransactionForm } from './TransactionForm';

type Composer = { open: (initial?: Partial<Transaction>) => void };
const ComposerContext = createContext<Composer>({ open: () => {} });

/** Lets any screen open the add / edit transaction dialog. */
export function ComposerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ initial: Partial<Transaction> | null; key: number } | null>(null);
  const open = useCallback((initial?: Partial<Transaction>) => setState({ initial: initial ?? null, key: Date.now() }), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <ComposerContext.Provider value={value}>
      {children}
      {state ? <TransactionForm key={state.key} initial={state.initial} onClose={() => setState(null)} /> : null}
    </ComposerContext.Provider>
  );
}

export const useComposer = () => useContext(ComposerContext);
