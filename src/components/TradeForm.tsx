import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { formatDigits, isSpendable, parseVndExpression, todayKey, type Asset } from '../finance';
import { positionFromTrades, TRADE_LABEL, tradeCashFlow, type Trade, type TradeSide } from '../investments';
import { newId, useStore } from '../store';
import { useMoney, useTheme } from '../theme';
import { walletOptions } from './accounts';
import { parseQuantity } from './AssetForm';
import { DateField } from './DateField';
import { Chips, Field, Sheet } from './Sheet';
import { useToast } from './Toast';
import { AmountInput, Input } from './ui';

type Props = {
  visible: boolean;
  asset: Asset;
  trade: Trade | null;
  onClose: () => void;
};

const SIDES = (['buy', 'sell', 'dividend', 'bonus'] as TradeSide[]).map((id) => ({ id, label: TRADE_LABEL[id], icon: null }));

/** Record a buy, a sale or a dividend for a holding. */
export function TradeForm({ visible, asset, trade, onClose }: Props) {
  const { ui } = useTheme();
  const { assets, trades, saveTrade, deleteTrade } = useStore();
  const toast = useToast();
  const format = useMoney();

  const [side, setSide] = useState<TradeSide>('buy');
  const [date, setDate] = useState(todayKey());
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSide(trade?.side ?? 'buy');
    setDate(trade?.date ?? todayKey());
    setQuantity(trade?.quantity ? String(trade.quantity).replace('.', ',') : '');
    setPrice(trade ? formatDigits(trade.price) : asset.price ? formatDigits(asset.price) : '');
    setFee(trade?.fee ? formatDigits(trade.fee) : '');
    setAccountId(trade?.accountId ?? '');
    setError('');
  }, [visible, trade, asset.price]);

  const unit = asset.category === 'gold' ? 'chỉ' : asset.symbol || 'đơn vị';
  const needsQuantity = side !== 'dividend';
  const needsPrice = side !== 'bonus';
  const held = positionFromTrades(trades.filter((t) => t.assetId === asset.id && t.id !== trade?.id)).quantity;
  const available = trades.some((t) => t.assetId === asset.id) ? held : (asset.quantity ?? 0);

  const draft = (): Trade | string => {
    const qty = needsQuantity ? parseQuantity(quantity) : 0;
    if (qty === null) return 'Số lượng không hợp lệ. Ví dụ: 100 hoặc 0,05.';
    const unitPrice = needsPrice ? parseVndExpression(price) : 0;
    if (unitPrice === null) return side === 'dividend' ? 'Nhập số tiền cổ tức nhận được.' : `Giá 1 ${unit} không hợp lệ.`;
    const feeValue = fee.trim() ? parseVndExpression(fee) : 0;
    if (feeValue === null) return 'Phí không hợp lệ.';
    if (side === 'sell' && qty > available + 1e-9) {
      return `Chỉ còn ${String(available).replace('.', ',')} ${unit} để bán.`;
    }
    return {
      id: trade?.id ?? newId(),
      assetId: asset.id,
      side,
      date,
      quantity: qty,
      price: unitPrice,
      fee: feeValue,
      note: trade?.note,
      accountId: side === 'bonus' ? undefined : accountId || undefined,
      transactionId: trade?.transactionId,
    };
  };

  const preview = draft();
  const cash = typeof preview === 'string' ? 0 : tradeCashFlow(preview);

  const save = () => {
    const next = draft();
    if (typeof next === 'string') return setError(next);
    saveTrade(next);
    onClose();
    toast.show({ message: `Đã ghi lệnh ${TRADE_LABEL[next.side].toLowerCase()}.`, tone: 'success' });
  };

  const remove = () => {
    if (!trade) return;
    deleteTrade(trade.id);
    onClose();
    toast.show({ message: 'Đã xoá lệnh.', actionLabel: 'Hoàn tác', onAction: () => saveTrade({ ...trade, transactionId: undefined }) });
  };

  return (
    <Sheet
      visible={visible}
      title={trade ? 'Sửa lệnh' : `Thêm lệnh · ${asset.name}`}
      onClose={onClose}
      onSave={save}
      onDelete={trade ? remove : undefined}
      error={error}
    >
      <Field label="Loại lệnh">
        <Chips options={SIDES} value={side} onChange={(id) => setSide(id as TradeSide)} showIcons={false} />
      </Field>
      <Field label="Ngày">
        <DateField value={date} onChange={setDate} shortcuts />
      </Field>
      {needsQuantity ? (
        <Field
          label={`Số lượng (${unit})`}
          hint={side === 'sell' ? `Đang giữ ${String(available).replace('.', ',')} ${unit}.` : undefined}
        >
          <Input value={quantity} onChangeText={setQuantity} placeholder="Ví dụ: 100" keyboardType="decimal-pad" accessibilityLabel="Số lượng" />
        </Field>
      ) : null}
      {needsPrice ? (
        <Field label={side === 'dividend' ? 'Số tiền nhận được (VND)' : `Giá 1 ${unit} (VND)`}>
          <AmountInput value={price} onChangeText={setPrice} placeholder="Ví dụ: 85.000" accessibilityLabel="Giá" />
        </Field>
      ) : null}
      {side !== 'bonus' ? (
        <>
          <Field label="Phí và thuế (tuỳ chọn)">
            <AmountInput value={fee} onChangeText={setFee} placeholder="0" accessibilityLabel="Phí và thuế" />
          </Field>
          <Field
            label={side === 'buy' ? 'Trả tiền từ ví' : 'Nhận tiền vào ví'}
            hint="Chọn ví để số dư ví thay đổi theo lệnh này."
          >
            <Chips options={walletOptions(assets.filter((a) => isSpendable(a) && a.category !== 'debt'), accountId)} value={accountId} onChange={setAccountId} />
          </Field>
        </>
      ) : null}
      {cash !== 0 ? (
        <Text style={ui.label}>
          {cash < 0 ? 'Tổng tiền phải trả' : 'Tổng tiền nhận về'}: {format(Math.abs(cash))}
        </Text>
      ) : null}
    </Sheet>
  );
}
