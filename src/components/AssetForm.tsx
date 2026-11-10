import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import {
  addMonths,
  CATEGORIES,
  formatDigits,
  MARKET_CATEGORIES,
  parseVndExpression,
  todayKey,
  type Asset,
  type CategoryId,
} from '../finance';
import { newId, useStore } from '../store';
import { useTheme } from '../theme';
import { DateField } from './DateField';
import { Chips, Field, Sheet } from './Sheet';
import { useToast } from './Toast';
import { AmountInput, Input, Segmented, ToggleRow } from './ui';

type Props = {
  visible: boolean;
  asset: Asset | null;
  /** Category preselected for a new asset. */
  defaultCategory?: CategoryId;
  onClose: () => void;
  /** Called after an existing asset was deleted, e.g. to leave its detail screen. */
  onDeleted?: () => void;
};

export const parseQuantity = (text: string): number | null => {
  const value = Number(text.trim().replace(/\s/g, '').replace(',', '.'));
  return text.trim() && Number.isFinite(value) && value > 0 ? value : null;
};

const CURRENCIES = ['USD', 'EUR', 'JPY', 'KRW', 'CNY', 'SGD', 'AUD', 'GBP', 'THB'].map((id) => ({ id, label: id, icon: null }));
const TERMS = [
  { id: '1', label: '1 tháng', icon: null },
  { id: '3', label: '3 tháng', icon: null },
  { id: '6', label: '6 tháng', icon: null },
  { id: '12', label: '12 tháng', icon: null },
  { id: '0', label: 'Chọn ngày', icon: null },
];

const SYMBOL_HINT: Partial<Record<CategoryId, string>> = {
  stock: 'Ví dụ: FPT, VNM, HPG',
  crypto: 'Ví dụ: BTC, ETH, SOL',
};

/** Add or edit an asset. The fields follow the kind of asset: wallet, deposit, loan, or a priced holding. */
export function AssetForm({ visible, asset, defaultCategory = 'cash', onClose, onDeleted }: Props) {
  const { ui } = useTheme();
  const { saveAsset, deleteAsset, saveTrade, trades } = useStore();
  const toast = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<CategoryId>('cash');
  const [amount, setAmount] = useState('');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [manualPrice, setManualPrice] = useState(false);
  const [price, setPrice] = useState('');
  const [averageCost, setAverageCost] = useState('');
  const [rate, setRate] = useState('');
  const [hasTerm, setHasTerm] = useState(false);
  const [startDate, setStartDate] = useState(todayKey());
  const [dueDate, setDueDate] = useState(addMonths(6));
  const [term, setTerm] = useState('6');
  const [counterparty, setCounterparty] = useState('');
  const [error, setError] = useState('');

  const hasTrades = !!asset && trades.some((t) => t.assetId === asset.id);

  useEffect(() => {
    if (!visible) return;
    const c = asset?.category ?? defaultCategory;
    setName(asset?.name ?? '');
    setCategory(c);
    setAmount(asset ? formatDigits(asset.amount) : '');
    setSymbol(asset?.symbol ?? (c === 'fx' ? 'USD' : ''));
    setQuantity(asset?.quantity ? String(asset.quantity).replace('.', ',') : '');
    setManualPrice(asset?.priceMode === 'manual');
    setPrice(asset?.priceMode === 'manual' && asset.price ? formatDigits(asset.price) : '');
    setAverageCost('');
    setRate(asset?.interestRate ? String(asset.interestRate).replace('.', ',') : '');
    setHasTerm(!!asset?.dueDate);
    setStartDate(asset?.startDate ?? todayKey());
    setDueDate(asset?.dueDate ?? addMonths(6));
    setTerm(asset?.dueDate ? '0' : '6');
    setCounterparty(asset?.counterparty ?? '');
    setError('');
  }, [visible, asset, defaultCategory]);

  const changeCategory = (id: string) => {
    const next = id as CategoryId;
    setCategory(next);
    setSymbol(next === 'fx' ? 'USD' : next === 'gold' ? '' : category === 'fx' ? '' : symbol);
    setManualPrice(false);
    setError('');
  };

  const isMarket = MARKET_CATEGORIES.includes(category);
  const isGold = category === 'gold';
  const isFx = category === 'fx';
  const isLoan = category === 'lent' || category === 'debt';
  const isSaving = category === 'saving';
  const cleanSymbol = isGold ? 'XAU' : symbol.trim().toUpperCase();
  const qty = isMarket ? parseQuantity(quantity) : null;
  // Gold and currencies are always counted in units; stocks and coins only once a ticker is given.
  const tracked = isMarket && (isGold || isFx || !!cleanSymbol) && qty !== null;
  const unit = isGold ? 'chỉ' : isFx ? cleanSymbol || 'đơn vị' : 'đơn vị';

  const pickTerm = (id: string) => {
    setTerm(id);
  };

  const save = () => {
    if (isMarket && (isGold || isFx || cleanSymbol) && qty === null) {
      return setError(isGold ? 'Nhập số chỉ vàng đang giữ, ví dụ 5 hoặc 2,5.' : 'Nhập số lượng đang nắm giữ, ví dụ 100 hoặc 0,05.');
    }
    const manual = tracked && manualPrice;
    const unitPrice = manual ? parseVndExpression(price) : null;
    if (manual && !unitPrice) return setError(`Nhập giá 1 ${unit} bằng VND, ví dụ 15,2tr.`);

    // Holdings get their value from quantity × price; the typed amount only applies to everything else.
    const typed = amount.trim() === '' ? (tracked || asset ? 0 : null) : parseVndExpression(amount);
    if (!tracked && typed === null) return setError('Số tiền không hợp lệ. Ví dụ: 23.000.000, 23tr hoặc 23000k.');

    const ratePercent = rate.trim() ? Number(rate.trim().replace(',', '.')) : undefined;
    if (ratePercent !== undefined && (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100)) {
      return setError('Lãi suất không hợp lệ. Ví dụ: 5,5 (%/năm).');
    }
    const withDates = (isSaving || isLoan) && hasTerm;
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const due = isSaving && term !== '0' ? addMonths(Number(term), new Date(sy, sm - 1, sd)) : dueDate;
    if (withDates && isSaving && due <= startDate) return setError('Ngày đáo hạn phải sau ngày gửi.');

    const cost = !asset && tracked && averageCost.trim() ? parseVndExpression(averageCost) : null;
    if (!asset && tracked && averageCost.trim() && !cost) return setError(`Giá vốn 1 ${unit} không hợp lệ.`);

    const label = CATEGORIES.find((c) => c.id === category)?.label ?? '';
    const sameHolding = asset?.symbol === cleanSymbol && asset?.quantity === qty && asset?.priceMode !== 'manual';
    const knownPrice = manual ? unitPrice! : tracked && sameHolding ? asset?.price : undefined;
    const now = new Date().toISOString();
    const id = asset?.id ?? newId();
    saveAsset({
      id,
      name: name.trim() || (isGold ? 'Vàng' : cleanSymbol) || label,
      category,
      amount: tracked ? (knownPrice ? Math.round(knownPrice * qty!) : (asset?.amount ?? 0)) : typed!,
      updatedAt: now,
      symbol: tracked ? cleanSymbol : undefined,
      // With a purchase price the units come from the opening trade recorded below.
      quantity: tracked ? (cost ? 0 : qty!) : undefined,
      price: knownPrice,
      priceUpdatedAt: manual ? now : knownPrice ? asset?.priceUpdatedAt : undefined,
      priceMode: tracked ? (manual ? 'manual' : 'market') : undefined,
      interestRate: isSaving || isLoan ? ratePercent : undefined,
      startDate: (isSaving || isLoan) && (withDates || ratePercent) ? startDate : undefined,
      dueDate: withDates ? due : undefined,
      counterparty: isLoan ? counterparty.trim() || undefined : undefined,
      note: asset?.note,
    });
    // The purchase price becomes the holding's first trade, so profit and loss can be shown.
    if (cost) {
      saveTrade({ id: newId(), assetId: id, side: 'buy', date: todayKey(), quantity: qty!, price: cost, fee: 0, note: 'Số dư ban đầu' });
    }
    onClose();
    toast.show({ message: asset ? 'Đã cập nhật tài sản.' : 'Đã thêm tài sản.', tone: 'success' });
  };

  const remove = () => {
    if (!asset) return;
    deleteAsset(asset.id);
    onClose();
    onDeleted?.();
    toast.show({ message: `Đã xoá ${asset.name}.` });
  };

  const amountLabel =
    category === 'debt' ? 'Số tiền đang nợ (VND)' : category === 'lent' ? 'Số tiền cho vay (VND)' : asset ? 'Số dư hiện tại (VND)' : 'Số dư ban đầu (VND)';

  return (
    <Sheet
      visible={visible}
      title={asset ? 'Sửa tài sản' : 'Thêm tài sản'}
      onClose={onClose}
      onSave={save}
      onDelete={asset ? remove : undefined}
      confirmDelete={
        asset
          ? 'Tài sản và lịch sử mua bán của nó sẽ bị xoá. Các giao dịch thu chi vẫn được giữ lại nhưng không còn gắn với tài sản này.'
          : undefined
      }
      error={error}
    >
      <Field label="Loại">
        <Chips options={CATEGORIES} value={category} onChange={changeCategory} />
      </Field>

      {isFx ? (
        <Field label="Loại ngoại tệ">
          <Chips options={CURRENCIES} value={cleanSymbol} onChange={setSymbol} />
        </Field>
      ) : null}

      {category === 'stock' || category === 'crypto' ? (
        <Field
          label={category === 'stock' ? 'Mã cổ phiếu (tuỳ chọn)' : 'Mã coin (tuỳ chọn)'}
          hint="Có mã và số lượng thì giá trị tự cập nhật theo thị trường."
        >
          <Input
            value={symbol}
            onChangeText={setSymbol}
            placeholder={SYMBOL_HINT[category]}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!hasTrades}
            accessibilityLabel="Mã"
          />
        </Field>
      ) : null}

      {isMarket && (isGold || isFx || symbol.trim()) ? (
        <Field
          label={isGold ? 'Số lượng (chỉ)' : isFx ? `Số ${cleanSymbol} đang giữ` : 'Số lượng đang nắm giữ'}
          hint={
            hasTrades
              ? 'Số lượng được tính từ lịch sử mua bán. Thêm lệnh mua/bán trong trang chi tiết để thay đổi.'
              : isGold
                ? '1 lượng (cây) = 10 chỉ.'
                : undefined
          }
        >
          <Input
            value={quantity}
            onChangeText={setQuantity}
            placeholder={isGold ? 'Ví dụ: 5' : isFx ? 'Ví dụ: 1000' : category === 'stock' ? 'Ví dụ: 100' : 'Ví dụ: 0,05'}
            keyboardType="decimal-pad"
            editable={!hasTrades}
            accessibilityLabel="Số lượng"
          />
        </Field>
      ) : null}

      {tracked && (isGold || isFx) ? (
        <Field
          label="Cách tính giá"
          hint={
            isGold
              ? 'Giá thế giới quy đổi thường thấp hơn giá vàng SJC trong nước. Chọn "Tự nhập giá" để dùng giá mua vào của tiệm vàng.'
              : 'Tỷ giá tham khảo có thể lệch nhẹ so với bảng giá ngân hàng.'
          }
        >
          <Segmented
            options={[
              { id: 'market', label: isGold ? 'Giá thế giới' : 'Tỷ giá tự động' },
              { id: 'manual', label: 'Tự nhập giá' },
            ]}
            value={manualPrice ? 'manual' : 'market'}
            onChange={(id) => setManualPrice(id === 'manual')}
          />
        </Field>
      ) : null}

      {tracked && manualPrice ? (
        <Field label={`Giá 1 ${unit} (VND)`}>
          <AmountInput value={price} onChangeText={setPrice} placeholder={isGold ? 'Ví dụ: 15,2tr' : 'Ví dụ: 26.300'} accessibilityLabel="Giá một đơn vị" />
        </Field>
      ) : null}

      {tracked && !asset ? (
        <Field label={`Giá vốn 1 ${unit} (tuỳ chọn)`} hint="Giá bạn đã mua. Có giá vốn, app sẽ tính lãi/lỗ cho khoản này.">
          <AmountInput value={averageCost} onChangeText={setAverageCost} placeholder="Ví dụ: 85.000" accessibilityLabel="Giá vốn" />
        </Field>
      ) : null}

      <Field label={isLoan ? 'Tên khoản (tuỳ chọn)' : 'Tên (tuỳ chọn)'}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder={
            category === 'bank'
              ? 'Ví dụ: Vietcombank, MoMo'
              : isSaving
                ? 'Ví dụ: Sổ tiết kiệm 6 tháng'
                : category === 'debt'
                  ? 'Ví dụ: Thẻ tín dụng, Vay mua xe'
                  : category === 'lent'
                    ? 'Ví dụ: Cho anh Nam vay'
                    : 'Ví dụ: Ví tiền mặt'
          }
          accessibilityLabel="Tên tài sản"
        />
      </Field>

      {tracked ? (
        <Text style={ui.label}>
          {manualPrice ? 'Giá trị = số lượng × giá bạn nhập.' : 'Giá trị sẽ tự cập nhật theo giá thị trường sau khi lưu.'}
        </Text>
      ) : (
        <Field
          label={amountLabel}
          hint={asset ? 'Đổi số dư ở đây sẽ ghi một khoản "Điều chỉnh số dư" vào lịch sử.' : undefined}
        >
          <AmountInput value={amount} onChangeText={setAmount} placeholder="23.000.000 hoặc 23tr" />
        </Field>
      )}

      {isLoan ? (
        <Field label={category === 'debt' ? 'Nợ ai / tổ chức nào (tuỳ chọn)' : 'Cho ai vay (tuỳ chọn)'}>
          <Input value={counterparty} onChangeText={setCounterparty} placeholder="Ví dụ: Ngân hàng ACB" accessibilityLabel="Người liên quan" />
        </Field>
      ) : null}

      {isSaving || isLoan ? (
        <>
          <Field label="Lãi suất (%/năm, tuỳ chọn)">
            <Input value={rate} onChangeText={setRate} placeholder="Ví dụ: 5,5" keyboardType="decimal-pad" accessibilityLabel="Lãi suất" />
          </Field>
          <ToggleRow
            title={isSaving ? 'Có kỳ hạn' : 'Có ngày đến hạn'}
            subtitle={isSaving ? 'Theo dõi ngày đáo hạn và tiền lãi dự kiến.' : 'Để app nhắc trước ngày phải trả.'}
            value={hasTerm}
            onChange={setHasTerm}
          />
          {hasTerm || rate.trim() ? (
            <Field label={isSaving ? 'Ngày gửi' : 'Ngày bắt đầu'}>
              <DateField value={startDate} onChange={setStartDate} accessibilityLabel="Ngày bắt đầu" />
            </Field>
          ) : null}
          {hasTerm ? (
            <Field label={isSaving ? 'Kỳ hạn' : 'Ngày đến hạn'}>
              {isSaving ? <Chips options={TERMS} value={term} onChange={pickTerm} showIcons={false} /> : null}
              {!isSaving || term === '0' ? (
                <DateField value={dueDate} onChange={setDueDate} accessibilityLabel="Ngày đến hạn" />
              ) : null}
            </Field>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
