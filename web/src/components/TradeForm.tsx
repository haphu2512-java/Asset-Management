import { useState } from 'react';
import { formatDigits, formatVnd, parseVndExpression, todayKey, type Asset } from '@shared/finance';
import { positionFromTrades, TRADE_LABEL, tradeCashFlow, type Trade, type TradeSide } from '@shared/investments';
import { newId, useStore } from '@shared/store';
import { parseQuantity, quantityText, walletOptions } from './options';
import { useToast } from './Toast';
import { AmountInput, Chips, DateInput, Field, Modal } from './ui';

const SIDES = (Object.keys(TRADE_LABEL) as TradeSide[]).map((id) => ({ id, label: TRADE_LABEL[id] }));

export function TradeForm({ asset, trade, onClose }: { asset: Asset; trade: Trade | null; onClose: () => void }) {
  const { assets, trades, saveTrade, deleteTrade } = useStore();
  const toast = useToast();
  const [side, setSide] = useState<TradeSide>(trade?.side ?? 'buy');
  const [date, setDate] = useState(trade?.date ?? todayKey());
  const [quantity, setQuantity] = useState(trade?.quantity ? String(trade.quantity).replace('.', ',') : '');
  const [price, setPrice] = useState(trade ? formatDigits(trade.price) : asset.price ? formatDigits(asset.price) : '');
  const [fee, setFee] = useState(trade?.fee ? formatDigits(trade.fee) : '');
  const [accountId, setAccountId] = useState(trade?.accountId ?? '');
  const [error, setError] = useState('');

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
    if (side === 'sell' && qty > available + 1e-9) return `Chỉ còn ${quantityText(available)} ${unit} để bán.`;
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
    <Modal title={trade ? 'Sửa lệnh' : `Thêm lệnh · ${asset.name}`} onClose={onClose} onSave={save} onDelete={trade ? remove : undefined} error={error}>
      <Field label="Loại lệnh">
        <Chips options={SIDES} value={side} onChange={(id) => setSide(id as TradeSide)} />
      </Field>
      <Field label="Ngày">
        <DateInput value={date} onChange={setDate} />
      </Field>
      {needsQuantity ? (
        <Field label={`Số lượng (${unit})`} hint={side === 'sell' ? `Đang giữ ${quantityText(available)} ${unit}.` : undefined}>
          <input className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Ví dụ: 100" inputMode="decimal" autoFocus={!trade} />
        </Field>
      ) : null}
      {needsPrice ? (
        <Field label={side === 'dividend' ? 'Số tiền nhận được (VND)' : `Giá 1 ${unit} (VND)`}>
          <AmountInput value={price} onChange={setPrice} placeholder="Ví dụ: 85.000" large={false} />
        </Field>
      ) : null}
      {side !== 'bonus' ? (
        <>
          <Field label="Phí và thuế (tuỳ chọn)">
            <AmountInput value={fee} onChange={setFee} placeholder="Ví dụ: 15k" large={false} />
          </Field>
          <Field label={cash < 0 ? 'Trả tiền từ ví' : 'Nhận tiền vào ví'} hint="Chọn ví để số dư ví tự cộng trừ theo lệnh này.">
            <Chips options={walletOptions(assets, accountId)} value={accountId} onChange={setAccountId} />
          </Field>
          {cash !== 0 ? (
            <span className="label">
              {cash < 0 ? 'Tổng tiền phải trả: ' : 'Tổng tiền nhận về: '}
              <strong className="num">{formatVnd(Math.abs(cash))}</strong>
            </span>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
