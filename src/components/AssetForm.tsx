import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { CATEGORIES, formatDigits, parseVnd, type Asset, type CategoryId } from '../finance';
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

export function AssetForm({ visible, asset, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CategoryId>('cash');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(asset?.name ?? '');
    setCategory(asset?.category ?? 'cash');
    setAmount(asset ? formatDigits(asset.amount) : '');
    setError('');
  }, [visible, asset]);

  const save = () => {
    const value = parseVnd(amount);
    if (value === null) return setError('Số tiền không hợp lệ. Ví dụ: 23.000.000, 23tr hoặc 23000k.');
    const label = CATEGORIES.find((c) => c.id === category)?.label ?? '';
    onSave({
      id: asset?.id ?? newId(),
      name: name.trim() || label,
      category,
      amount: value,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      title={asset ? 'Sửa tài sản' : 'Thêm tài sản'}
      onClose={onClose}
      onSave={save}
      onDelete={asset ? () => (onDelete(asset.id), onClose()) : undefined}
      error={error}
    >
      <Field label="Loại">
        <Chips options={CATEGORIES} value={category} onChange={(id) => setCategory(id as CategoryId)} />
      </Field>
      <Field label="Tên (tuỳ chọn)">
        <TextInput
          placeholderTextColor={colors.muted}
          style={ui.input}
          value={name}
          onChangeText={setName}
          placeholder="Ví dụ: Tài khoản Techcombank, VN30, BTC..."
        />
      </Field>
      <Field label="Số tiền (VND)">
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
    </Sheet>
  );
}
