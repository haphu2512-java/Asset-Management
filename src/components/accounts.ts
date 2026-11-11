import { getCategory, isAccount, isSpendable, type Asset } from '../finance';
import type { ChipOption } from './Sheet';

const toOption = (a: Asset): ChipOption => ({
  id: a.id,
  label: a.name,
  icon: a.category,
  color: getCategory(a.category).color,
});

/** Wallets a purchase can be paid from or income received into, plus "none". */
export function walletOptions(assets: Asset[], selectedId?: string): ChipOption[] {
  return [
    ...assets.filter((a) => isSpendable(a) || a.id === selectedId).map(toOption),
    { id: '', label: 'Không chọn ví', icon: null },
  ];
}

/** Every account money can be moved into or out of. */
export function accountOptions(assets: Asset[], selectedId?: string, exclude?: string): ChipOption[] {
  return assets.filter((a) => (isAccount(a) || a.id === selectedId) && a.id !== exclude).map(toOption);
}
