import { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';
import {
  CATEGORIES,
  formatDigits,
  isMarketPriced,
  parseVnd,
  type Asset,
  type CategoryId,
} from '../finance';
import { newId } from '../store';
import { colors, ui } from '../theme';
import { Chips, Field, Sheet } from './Sheet';

type Props = {
  visible: boolean;
  asset: Asset | null;
  onClose: () => void;
  onSave: (asset: Asset) => void;
  onDelete: (id: string) => void;
};

const parseQuantity = (text: string): number | null => {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(value) && value > 0 ? value : null;
};

export function AssetForm({ visible, asset, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CategoryId>('cash');
  const [amount, setAmount] = useState('');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(asset?.name ?? '');
    setCategory(asset?.category ?? 'cash');
    setAmount(asset ? formatDigits(asset.amount) : '');
    setSymbol(asset?.symbol ?? '');
    setQuantity(asset?.quantity ? String(asset.quantity) : '');
    setError('');
  }, [visible, asset]);

  const supportsMarket = category === 'stock' || category === 'crypto';

  const save = () => {
    const cleanSymbol = supportsMarket ? symbol.trim().toUpperCase() : '';
    const qty = supportsMarket ? parseQuantity(quantity) : null;
    if (cleanSymbol && qty === null) return setError('Nhập số lượng đang nắm giữ, ví dụ 100 hoặc 0,05.');
    const tracked = !!cleanSymbol && qty !== null;

    // Market-priced holdings get their amount from the price; the typed amount is optional.
    const value = amount.trim() === '' && tracked ? 0 : parseVnd(amount);
    if (value === null) return setError('Số tiền không hợp lệ. Ví dụ: 23.000.000, 23tr hoặc 23000k.');

    const label = CATEGORIES.find((c) => c.id === category)?.label ?? '';
    const sameHolding = asset?.symbol === cleanSymbol && asset?.quantity === qty;
    const price = tracked && sameHolding ? asset?.price : undefined;
    onSave({
      id: asset?.id ?? newId(),
      name: name.trim() || cleanSymbol || label,
      category,
      amount: price && qty ? Math.round(price * qty) : value,
      updatedAt: new Date().toISOString(),
      symbol: cleanSymbol || undefined,
      quantity: tracked ? qty! : undefined,
      price,
      priceUpdatedAt: price ? asset?.priceUpdatedAt : undefined,
    });
    onClose();
  };

  const tracked = supportsMarket && isMarketPriced({ category, symbol, quantity: parseQuantity(quantity) ?? 0 });

  return (
    <Sheet
      visible={visible}
      title={asset ? 'Sửa tài sản' : 'Thêm tài sản'}
      onClose={onClose}
      onSave={save}
      onDelete={asset ? () => (onDelete(asset.id), onClose()) : undefined}
      error={error}
    >
      <Field label="Loại" icon="assets">
        <Chips options={CATEGORIES} value={category} onChange={(id) => setCategory(id as CategoryId)} />
      </Field>
      {supportsMarket ? (
        <>
          <Field
            label={category === 'stock' ? 'Mã cổ phiếu (tuỳ chọn)' : 'Mã coin (tuỳ chọn)'}
            icon={category === 'stock' ? 'stock' : 'crypto'}
          >
            <TextInput
              placeholderTextColor={colors.muted}
              style={ui.input}
              value={symbol}
              onChangeText={setSymbol}
              placeholder={category === 'stock' ? 'Ví dụ: FPT, VNM, HPG' : 'Ví dụ: BTC, ETH, SOL'}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </Field>
          {symbol.trim() ? (
            <Field label="Số lượng đang nắm giữ" icon="pie-chart">
              <TextInput
                placeholderTextColor={colors.muted}
                style={ui.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder={category === 'stock' ? 'Ví dụ: 100' : 'Ví dụ: 0,05'}
                keyboardType="decimal-pad"
              />
            </Field>
          ) : null}
          {tracked ? (
            <Text style={ui.label}>Giá trị sẽ tự cập nhật theo giá thị trường sau khi lưu.</Text>
          ) : null}
        </>
      ) : null}
      <Field label="Tên (tuỳ chọn)" icon="edit">
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholder="Ví dụ: Tài khoản Techcombank, VN30, BTC..."
        />
      </Field>
      {tracked ? null : (
        <Field label="Số tiền (VND)" icon="wallet">
          <TextInput
            placeholderTextColor={colors.muted}
            style={ui.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="23.000.000 hoặc 23tr"
            keyboardType="default"
            autoCapitalize="none"
          />
        </Field>
      )}
    </Sheet>
  );
}
