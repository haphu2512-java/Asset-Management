import { getTransactionCategory, type Asset, type Transaction, type TransactionCategory } from '@shared/finance';
import { flowFor, transactionAccounts, transactionTitle } from '@shared/ledger';
import { useMoney } from '../hooks';
import { Badge } from './Icon';

type Props = {
  tx: Transaction;
  categories: TransactionCategory[];
  assets: Asset[];
  onClick?: () => void;
  /** When set, amounts are signed from this account's point of view. */
  accountId?: string;
  showDate?: string;
};

export function TransactionRow({ tx, categories, assets, onClick, accountId, showDate }: Props) {
  const format = useMoney();
  const category = tx.kind === 'transfer' ? null : getTransactionCategory(tx.category, categories);
  const accounts = transactionAccounts(tx, assets);
  let sign = tx.kind === 'income' ? '+' : tx.kind === 'expense' ? '-' : '';
  let tone = tx.kind === 'income' ? 'income' : tx.kind === 'expense' ? 'expense' : '';
  if (accountId && tx.kind === 'transfer') {
    const incoming = flowFor(tx, accountId) > 0;
    sign = incoming ? '+' : '-';
    tone = incoming ? 'income' : 'expense';
  }
  const sub = [showDate, category && tx.note ? category.label : null, accounts].filter(Boolean).join(' · ');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="item" onClick={onClick} type={onClick ? 'button' : undefined}>
      <Badge color={category?.color ?? '#546E7A'} icon={category ? undefined : 'transfer'} letter={category?.label} />
      <span className="grow">
        <span className="title" style={{ display: 'block' }}>
          {transactionTitle(tx, assets, categories)}
        </span>
        {sub ? <span className="sub" style={{ display: 'block' }}>{sub}</span> : null}
      </span>
      <span className={`right num ${tone}`}>
        {sign}
        {format(tx.amount)}
      </span>
    </Tag>
  );
}
