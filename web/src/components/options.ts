import { getCategory, isAccount, isSpendable, type Asset } from '@shared/finance';
import type { ChipOption } from './ui';

const toOption = (a: Asset): ChipOption => ({ id: a.id, label: a.name, color: getCategory(a.category).color });

/** Wallets a purchase can be paid from or income received into, plus "none". */
export function walletOptions(assets: Asset[], selectedId?: string): ChipOption[] {
  return [...assets.filter((a) => isSpendable(a) || a.id === selectedId).map(toOption), { id: '', label: 'Không chọn ví' }];
}

/** Every account money can be moved into or out of. */
export function accountOptions(assets: Asset[], selectedId?: string, exclude?: string): ChipOption[] {
  return assets.filter((a) => (isAccount(a) || a.id === selectedId) && a.id !== exclude).map(toOption);
}

export const parseQuantity = (text: string): number | null => {
  const value = Number(text.trim().replace(/\s/g, '').replace(',', '.'));
  return text.trim() && Number.isFinite(value) && value > 0 ? value : null;
};

export const quantityText = (n: number) => String(Math.round(n * 1e8) / 1e8).replace('.', ',');
