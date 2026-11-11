import { getTransactionCategory, type Transaction } from '../finance';
import { flowFor, isAdjustment, transactionAccounts, transactionTitle } from '../ledger';
import { useStore } from '../store';
import { useMoney, useTheme } from '../theme';
import { useComposer } from './Composer';
import { getCategoryIcon } from './Icon';
import { CategoryBadge, ListItem } from './ui';

const shortDate = (date: string) => {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
};

type Props = {
  transaction: Transaction;
  showDate?: boolean;
  /** When set, the amount is signed from this account's point of view (transfers in are +). */
  perspective?: string;
};

/** A transaction in a list; tapping opens it for editing. */
export function TransactionRow({ transaction: t, showDate, perspective }: Props) {
  const { colors } = useTheme();
  const { assets, categories } = useStore();
  const composer = useComposer();
  const format = useMoney();

  const category = t.kind === 'transfer' ? null : getTransactionCategory(t.category, categories);
  const flow = perspective ? flowFor(t, perspective) : t.kind === 'income' ? t.amount : t.kind === 'expense' ? -t.amount : 0;
  const sign = flow > 0 ? '+' : flow < 0 ? '-' : '';
  const color = flow > 0 ? colors.income : flow < 0 ? colors.expense : colors.text;
  const accounts = transactionAccounts(t, assets);
  const subtitle = [
    showDate ? shortDate(t.date) : null,
    t.note && category ? category.label : null,
    t.note && !category ? (isAdjustment(t) ? 'Điều chỉnh số dư' : 'Chuyển khoản') : null,
    accounts || null,
    t.recurringId ? 'Định kỳ' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ListItem
      leading={
        <CategoryBadge
          icon={category ? getCategoryIcon(category.icon ?? category.id) : isAdjustment(t) ? 'adjust' : 'transfer'}
          color={category?.color ?? '#546E7A'}
        />
      }
      title={transactionTitle(t, assets, categories)}
      subtitle={subtitle || undefined}
      right={`${sign}${format(t.amount)}`}
      rightColor={color}
      onPress={() => composer.open(t)}
      accessibilityLabel={`${transactionTitle(t, assets, categories)}, ${
        flow > 0 ? 'thu' : flow < 0 ? 'chi' : 'chuyển'
      } ${format(t.amount)}${subtitle ? `, ${subtitle}` : ''}. Chạm để sửa`}
    />
  );
}
