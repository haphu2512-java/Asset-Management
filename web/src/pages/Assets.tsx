import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CATEGORIES,
  changeLabel,
  compareValue,
  formatDigits,
  isHolding,
  isMarketPriced,
  summarize,
  todayKey,
  type Asset,
  type CategoryId,
} from '@shared/finance';
import { interestInfo, portfolioPerformance } from '@shared/investments';
import { useStore } from '@shared/store';
import { AssetForm } from '../components/AssetForm';
import { ASSET_ICON, Badge } from '../components/Icon';
import { quantityText } from '../components/options';
import { Button, Card, CardHeader, ChangeBadge, Chips, EmptyState } from '../components/ui';
import { shortDate, useMoney } from '../hooks';

/** One line describing an asset: its holding and price, its term, or who it is owed to. */
export function assetSubtitle(a: Asset, today: string): string | undefined {
  if (isHolding(a)) {
    const unit = a.category === 'gold' ? ' chỉ' : '';
    const price = a.price ? ` × ${formatDigits(a.price)} ₫` : '';
    return `${a.category === 'gold' ? '' : `${a.symbol} · `}${quantityText(a.quantity!)}${unit}${price}${a.priceMode === 'manual' ? ' (giá tự nhập)' : ''}`;
  }
  const info = interestInfo(a, today);
  const parts = [
    a.counterparty,
    a.interestRate ? `${String(a.interestRate).replace('.', ',')}%/năm` : null,
    a.dueDate
      ? info?.daysLeft != null && info.daysLeft < 0
        ? `quá hạn từ ${shortDate(a.dueDate)}`
        : `${a.category === 'saving' ? 'đáo hạn' : 'đến hạn'} ${shortDate(a.dueDate)}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function AssetsPage() {
  const { assets, trades, baseline, refreshMarketPrices, pricesRefreshing } = useStore();
  const format = useMoney();
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [priceNote, setPriceNote] = useState('');

  const today = todayKey();
  const s = useMemo(() => summarize(assets), [assets]);
  const portfolio = useMemo(() => portfolioPerformance(assets, trades), [assets, trades]);
  const hasMarketAssets = assets.some(isMarketPriced);
  const netWorthChange = baseline ? compareValue(s.netWorth, baseline.netWorth) : null;
  const assetChange = (a: Asset) => (baseline && a.id in baseline.amounts ? compareValue(a.amount, baseline.amounts[a.id]) : null);

  const refresh = async () => {
    setPriceNote('');
    try {
      const missing = await refreshMarketPrices();
      setPriceNote(missing.length > 0 ? `Không tìm thấy giá: ${missing.join(', ')}.` : 'Đã cập nhật giá mới nhất.');
    } catch {
      setPriceNote('Lỗi mạng khi cập nhật giá.');
    }
  };

  const used = CATEGORIES.filter((c) => assets.some((a) => a.category === c.id));
  const shown = filter === 'all' ? used : used.filter((c) => c.id === filter);

  return (
    <>
      <div className="grid-2">
        <Card>
          <div className="row between">
            <span className="label">Tài sản ròng</span>
            <Button small label="Thêm tài sản" icon="plus" onClick={() => setFormOpen(true)} />
          </div>
          <div className={`big num ${s.netWorth < 0 ? 'expense' : ''}`}>{format(s.netWorth)}</div>
          <ChangeBadge change={netWorthChange} label={baseline ? changeLabel(baseline.date, today) : undefined} />
          {s.totalDebt > 0 ? (
            <span className="label num">
              Tổng tài sản {format(s.totalAssets)} · Nợ {format(s.totalDebt)}
            </span>
          ) : null}
          {hasMarketAssets ? (
            <div className="row wrap">
              <Button small variant="secondary" icon="refresh" label={pricesRefreshing ? 'Đang cập nhật…' : 'Cập nhật giá thị trường'} disabled={pricesRefreshing} onClick={refresh} />
              {priceNote ? <span className="caption">{priceNote}</span> : null}
            </div>
          ) : null}
        </Card>
        {portfolio.cost > 0 || portfolio.realized !== 0 || portfolio.dividends !== 0 ? (
          <Card>
            <CardHeader title="Hiệu quả đầu tư" icon="chart" />
            <div className="row between">
              <span className="label">Lãi/lỗ đang nắm giữ</span>
              <span className={`strong num ${portfolio.unrealized >= 0 ? 'income' : 'expense'}`}>
                {portfolio.unrealized >= 0 ? '+' : '-'}
                {format(Math.abs(portfolio.unrealized))}
                {portfolio.cost > 0 ? ` (${((portfolio.unrealized / portfolio.cost) * 100).toFixed(1).replace('.', ',')}%)` : ''}
              </span>
            </div>
            <div className="row between">
              <span className="label">Giá vốn → Giá trị</span>
              <span className="num">
                {format(portfolio.cost)} → {format(portfolio.value)}
              </span>
            </div>
            <div className="row between">
              <span className="label">Lãi/lỗ đã chốt</span>
              <span className={`num ${portfolio.realized >= 0 ? 'income' : 'expense'}`}>
                {portfolio.realized >= 0 ? '+' : '-'}
                {format(Math.abs(portfolio.realized))}
              </span>
            </div>
            <div className="row between">
              <span className="label">Cổ tức đã nhận</span>
              <span className="num">{format(portfolio.dividends)}</span>
            </div>
          </Card>
        ) : null}
      </div>

      {assets.length === 0 ? (
        <Card>
          <EmptyState
            icon="wallet"
            title="Chưa có tài sản"
            message="Thêm ví tiền mặt, tài khoản ngân hàng, sổ tiết kiệm, cổ phiếu, vàng hoặc khoản nợ để theo dõi tài sản ròng."
            actionLabel="Thêm tài sản"
            onAction={() => setFormOpen(true)}
          />
        </Card>
      ) : (
        <>
          {used.length > 1 ? (
            <Chips
              options={[{ id: 'all', label: 'Tất cả' }, ...used.map((c) => ({ id: c.id, label: c.label, color: c.color }))]}
              value={filter}
              onChange={(id) => setFilter(id as CategoryId | 'all')}
            />
          ) : null}
          <div className="grid">
            {shown.map((c) => {
              const list = assets.filter((a) => a.category === c.id);
              const total = list.reduce((sum, a) => sum + a.amount, 0);
              return (
                <Card key={c.id}>
                  <CardHeader title={c.label} right={<span className={`strong num ${c.isLiability ? 'expense' : ''}`}>{c.isLiability ? '-' : ''}{format(total)}</span>} />
                  <div className="list">
                    {list.map((a) => {
                      const change = assetChange(a);
                      return (
                        <Link className="item" key={a.id} to={`/assets/${a.id}`}>
                          <Badge color={c.color} icon={ASSET_ICON[c.id]} />
                          <span className="grow">
                            <span className="title" style={{ display: 'block' }}>{a.name}</span>
                            {assetSubtitle(a, today) ? <span className="sub" style={{ display: 'block' }}>{assetSubtitle(a, today)}</span> : null}
                          </span>
                          <span className="right num">
                            <span className={a.amount < 0 || c.isLiability ? 'expense' : ''}>{format(a.amount)}</span>
                            {change && change.direction !== 'flat' ? (
                              <span className={`caption ${(change.direction === 'up') !== c.isLiability ? 'income' : 'expense'}`} style={{ display: 'block' }}>
                                {change.direction === 'up' ? '▲' : '▼'} {change.percent !== null ? `${Math.abs(change.percent).toFixed(2).replace('.', ',')}%` : format(Math.abs(change.amount))}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
      {formOpen ? <AssetForm asset={null} defaultCategory={filter === 'all' ? 'cash' : filter} onClose={() => setFormOpen(false)} /> : null}
    </>
  );
}
