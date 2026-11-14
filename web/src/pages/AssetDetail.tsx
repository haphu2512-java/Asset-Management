import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { changeLabel, compareValue, formatDigits, getCategory, isHolding, parseVndExpression, todayKey } from '@shared/finance';
import { interestInfo, performance, positionFromTrades, TRADE_LABEL, tradeCashFlow, type Trade } from '@shared/investments';
import { accountTransactions } from '@shared/ledger';
import { useStore } from '@shared/store';
import { AssetForm } from '../components/AssetForm';
import { useComposer } from '../components/Composer';
import { quantityText } from '../components/options';
import { useToast } from '../components/Toast';
import { TradeForm } from '../components/TradeForm';
import { TransactionRow } from '../components/TransactionRow';
import { AmountInput, Banner, Button, Card, CardHeader, ChangeBadge, EmptyState, Field, Modal } from '../components/ui';
import { fullDate, useMoney } from '../hooks';
import { assetSubtitle } from './Assets';

const HISTORY_LIMIT = 50;

export function AssetDetailPage() {
  const { id = '' } = useParams();
  const { assets, transactions, trades, categories, baseline, adjustBalance } = useStore();
  const navigate = useNavigate();
  const composer = useComposer();
  const toast = useToast();
  const format = useMoney();
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustText, setAdjustText] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [trade, setTrade] = useState<{ trade: Trade | null } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const asset = assets.find((a) => a.id === id);
  const today = todayKey();
  const history = useMemo(() => accountTransactions(transactions, id), [transactions, id]);
  const ownTrades = useMemo(
    () => trades.filter((t) => t.assetId === id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [trades, id],
  );

  if (!asset) {
    return (
      <Card>
        <EmptyState icon="wallet" title="Tài sản không còn tồn tại" message="Tài sản này đã bị xoá." />
        <Button variant="secondary" label="Quay lại" onClick={() => navigate('/assets')} />
      </Card>
    );
  }

  const category = getCategory(asset.category);
  const holding = isHolding(asset) || ownTrades.length > 0;
  const change = baseline && asset.id in baseline.amounts ? compareValue(asset.amount, baseline.amounts[asset.id]) : null;
  const interest = interestInfo(asset, today);
  const perf = ownTrades.length > 0 ? performance(positionFromTrades(ownTrades), asset.amount) : null;
  const unit = asset.category === 'gold' ? 'chỉ' : (asset.symbol ?? '');
  const signed = (n: number) => `${n >= 0 ? '+' : '-'}${format(Math.abs(n))}`;
  const tone = (n: number) => (n >= 0 ? 'income' : 'expense');

  const saveAdjust = () => {
    const raw = adjustText.trim();
    const negative = raw.startsWith('-');
    const value = raw === '0' ? 0 : parseVndExpression(negative ? raw.slice(1) : raw);
    if (value === null) return setAdjustError('Số dư không hợp lệ. Ví dụ: 2.350.000.');
    adjustBalance(asset.id, negative ? -value : value);
    setAdjustOpen(false);
    toast.show({ message: 'Đã điều chỉnh số dư và ghi phần chênh lệch vào lịch sử.', tone: 'success' });
  };

  return (
    <>
      <Link to="/assets" className="link row" style={{ alignSelf: 'flex-start' }}>
        ‹ Tất cả tài sản
      </Link>
      <div className="grid-2">
        <Card>
          <div className="row between">
            <h2 style={{ fontSize: 18 }}>{asset.name}</h2>
            <Button small variant="secondary" icon="edit" label="Sửa" onClick={() => setEditOpen(true)} />
          </div>
          <span className="label">
            {category.label}
            {category.isLiability ? ' · số tiền còn nợ' : ''}
          </span>
          <div className={`big num ${asset.amount < 0 || category.isLiability ? 'expense' : ''}`}>{format(asset.amount)}</div>
          {assetSubtitle(asset, today) ? <span className="label">{assetSubtitle(asset, today)}</span> : null}
          {change ? <ChangeBadge change={change} label={baseline ? changeLabel(baseline.date, today) : undefined} /> : null}
          {asset.amount < 0 && !category.isLiability ? (
            <Banner tone="warning">Số dư đang âm: đã chi nhiều hơn số tiền ghi nhận. Hãy điều chỉnh số dư cho khớp thực tế.</Banner>
          ) : null}
          <div className="row wrap">
            {holding ? (
              <Button small label="Thêm lệnh" icon="plus" onClick={() => setTrade({ trade: null })} />
            ) : (
              <>
                {asset.category === 'debt' ? (
                  <Button small label="Trả nợ" icon="transfer" onClick={() => composer.open({ kind: 'transfer', toAccountId: asset.id, accountId: '', note: `Trả nợ: ${asset.name}` })} />
                ) : asset.category === 'lent' ? (
                  <Button small label="Thu nợ" icon="transfer" onClick={() => composer.open({ kind: 'transfer', accountId: asset.id, note: `Thu nợ: ${asset.name}` })} />
                ) : (
                  <Button small label="Chuyển khoản" icon="transfer" onClick={() => composer.open({ kind: 'transfer', accountId: asset.id })} />
                )}
                <Button
                  small
                  variant="secondary"
                  label="Điều chỉnh số dư"
                  onClick={() => {
                    setAdjustText(formatDigits(asset.amount));
                    setAdjustError('');
                    setAdjustOpen(true);
                  }}
                />
              </>
            )}
          </div>
        </Card>

        {interest ? (
          <Card>
            <CardHeader title={asset.category === 'debt' ? 'Lãi phát sinh' : 'Tiền lãi'} icon="clock" />
            <div className="row between">
              <span className="label">Lãi tính đến hôm nay</span>
              <span className="strong num">{format(interest.accrued)}</span>
            </div>
            {interest.atMaturity !== null ? (
              <div className="row between">
                <span className="label">{asset.category === 'saving' ? 'Lãi dự kiến khi đáo hạn' : 'Lãi đến ngày đến hạn'}</span>
                <span className="strong num">{format(interest.atMaturity)}</span>
              </div>
            ) : null}
            {interest.daysLeft !== null ? (
              <span className={`label ${interest.daysLeft < 0 ? 'expense' : ''}`}>
                {interest.daysLeft > 0
                  ? `Còn ${interest.daysLeft} ngày (${fullDate(asset.dueDate!)}).`
                  : interest.daysLeft === 0
                    ? 'Đến hạn hôm nay.'
                    : `Đã quá hạn ${-interest.daysLeft} ngày (${fullDate(asset.dueDate!)}).`}
              </span>
            ) : null}
            <span className="caption">Lãi đơn, tính theo ngày trên số dư hiện tại; con số thực tế tuỳ ngân hàng.</span>
          </Card>
        ) : null}

        {holding ? (
          <Card>
            <CardHeader title="Giá vốn và lãi/lỗ" icon="chart" />
            {perf && perf.costBasis > 0 ? (
              <>
                <div className="row between">
                  <span className="label">Lãi/lỗ chưa chốt</span>
                  <span className={`strong num ${tone(perf.unrealized)}`}>
                    {signed(perf.unrealized)}
                    {perf.unrealizedPercent !== null ? ` (${perf.unrealizedPercent.toFixed(1).replace('.', ',')}%)` : ''}
                  </span>
                </div>
                <div className="row between">
                  <span className="label">Giá vốn trung bình</span>
                  <span className="num">
                    {formatDigits(perf.averageCost)} ₫/{unit || 'đơn vị'}
                  </span>
                </div>
                <div className="row between">
                  <span className="label">Tổng vốn đang nắm giữ</span>
                  <span className="num">{format(perf.costBasis)}</span>
                </div>
              </>
            ) : (
              <span className="label">
                {perf && perf.quantity === 0 ? 'Không còn nắm giữ đơn vị nào.' : 'Chưa có giá vốn. Thêm lệnh mua với giá bạn đã mua để app tính lãi/lỗ.'}
              </span>
            )}
            {perf && perf.realized !== 0 ? (
              <div className="row between">
                <span className="label">Lãi/lỗ đã chốt</span>
                <span className={`num ${tone(perf.realized)}`}>{signed(perf.realized)}</span>
              </div>
            ) : null}
            {perf && perf.dividends !== 0 ? (
              <div className="row between">
                <span className="label">Cổ tức đã nhận</span>
                <span className="num">{format(perf.dividends)}</span>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>

      {holding ? (
        <Card>
          <CardHeader title="Lịch sử mua bán" icon="transactions" right={<Button small label="Thêm lệnh" icon="plus" onClick={() => setTrade({ trade: null })} />} />
          {ownTrades.length === 0 ? (
            <span className="label">Chưa có lệnh nào.</span>
          ) : (
            <div className="list">
              {ownTrades.map((t) => {
                const cash = tradeCashFlow(t);
                return (
                  <button className="item" key={t.id} onClick={() => setTrade({ trade: t })}>
                    <span className="grow">
                      <span className="title" style={{ display: 'block' }}>
                        {TRADE_LABEL[t.side]}
                        {t.quantity ? ` ${quantityText(t.quantity)} ${unit}` : ''}
                      </span>
                      <span className="sub" style={{ display: 'block' }}>
                        {[fullDate(t.date), t.side !== 'dividend' && t.side !== 'bonus' ? `giá ${formatDigits(t.price)} ₫` : null, t.note].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {cash !== 0 ? <span className={`right num ${tone(cash)}`}>{signed(cash)}</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader title="Lịch sử" icon="transactions" />
          {history.length === 0 ? (
            <span className="label">
              {asset.category === 'cash' || asset.category === 'bank'
                ? 'Chưa có giao dịch nào gắn với ví này. Khi thêm thu chi, hãy chọn ví để số dư tự cập nhật.'
                : 'Chưa có giao dịch chuyển tiền nào với tài khoản này.'}
            </span>
          ) : (
            <>
              <div className="list">
                {(showAll ? history : history.slice(0, HISTORY_LIMIT)).map((t) => (
                  <TransactionRow key={t.id} tx={t} categories={categories} assets={assets} accountId={asset.id} showDate={fullDate(t.date)} onClick={() => composer.open(t)} />
                ))}
              </div>
              {!showAll && history.length > HISTORY_LIMIT ? (
                <button className="link" onClick={() => setShowAll(true)}>
                  Xem tất cả {history.length} giao dịch
                </button>
              ) : null}
            </>
          )}
        </Card>
      )}

      {editOpen ? <AssetForm asset={asset} onClose={() => setEditOpen(false)} onDeleted={() => navigate('/assets')} /> : null}
      {trade ? <TradeForm asset={asset} trade={trade.trade} onClose={() => setTrade(null)} /> : null}
      {adjustOpen ? (
        <Modal title="Điều chỉnh số dư" onClose={() => setAdjustOpen(false)} onSave={saveAdjust} error={adjustError}>
          <Field
            label={category.isLiability ? 'Số tiền thực tế còn nợ (VND)' : 'Số dư thực tế (VND)'}
            hint="Phần chênh lệch so với số trong app được ghi thành một dòng “Điều chỉnh số dư”, không tính vào thu hay chi."
          >
            <AmountInput value={adjustText} onChange={setAdjustText} placeholder="Ví dụ: 2.350.000" autoFocus />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
