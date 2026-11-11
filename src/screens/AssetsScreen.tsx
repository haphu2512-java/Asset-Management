import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AssetForm } from '../components/AssetForm';
import { ChangeBadge } from '../components/ChangeBadge';
import { getCategoryIcon } from '../components/Icon';
import { Chips } from '../components/Sheet';
import { Button, Card, CardHeader, CategoryBadge, EmptyState, ListItem } from '../components/ui';
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
} from '../finance';
import { interestInfo, portfolioPerformance } from '../investments';
import { useNav } from '../nav';
import { useStore } from '../store';
import { font, useMoney, useTheme } from '../theme';

const formatQuantity = (n: number) => String(Math.round(n * 1e8) / 1e8).replace('.', ',');
const shortDate = (date: string) => {
  const [y, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
};

/** One line describing an asset: its holding and price, its term, or who it is owed to. */
export function assetSubtitle(a: Asset, today: string): string | undefined {
  if (isHolding(a)) {
    const unit = a.category === 'gold' ? ' chỉ' : '';
    const price = a.price ? ` × ${formatDigits(a.price)} ₫` : '';
    return `${a.category === 'gold' ? '' : `${a.symbol} · `}${formatQuantity(a.quantity!)}${unit}${price}${a.priceMode === 'manual' ? ' (giá tự nhập)' : ''}`;
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

export function AssetsScreen() {
  const { colors, ui } = useTheme();
  const { assets, trades, baseline, refreshMarketPrices, pricesRefreshing } = useStore();
  const nav = useNav();
  const format = useMoney();
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [priceNote, setPriceNote] = useState('');

  const today = todayKey();
  const s = useMemo(() => summarize(assets), [assets]);
  const portfolio = useMemo(() => portfolioPerformance(assets, trades), [assets, trades]);
  const hasMarketAssets = assets.some(isMarketPriced);
  const netWorthChange = baseline ? compareValue(s.netWorth, baseline.netWorth) : null;
  const assetChange = (a: Asset) =>
    baseline && a.id in baseline.amounts ? compareValue(a.amount, baseline.amounts[a.id]) : null;

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
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Card>
          <View style={ui.row}>
            <Text style={ui.label}>Tài sản ròng</Text>
            <Button small label="Thêm tài sản" icon="plus" onPress={() => setFormOpen(true)} />
          </View>
          <Text style={[ui.big, s.netWorth < 0 && { color: colors.expense }]}>{format(s.netWorth)}</Text>
          <ChangeBadge change={netWorthChange} label={baseline ? changeLabel(baseline.date, today) : undefined} />
          {s.totalDebt > 0 ? (
            <Text style={ui.label}>
              Tổng tài sản {format(s.totalAssets)} · Nợ {format(s.totalDebt)}
            </Text>
          ) : null}
        </Card>

        {portfolio.cost > 0 || portfolio.realized !== 0 || portfolio.dividends !== 0 ? (
          <Card>
            <CardHeader title="Hiệu quả đầu tư" icon="trending-up" />
            <View style={ui.row}>
              <Text style={ui.label}>Lãi/lỗ đang nắm giữ</Text>
              <Text style={{ fontSize: font.body, fontWeight: '700', color: portfolio.unrealized >= 0 ? colors.income : colors.expense }}>
                {portfolio.unrealized >= 0 ? '+' : '-'}
                {format(Math.abs(portfolio.unrealized))}
                {portfolio.cost > 0 ? ` (${((portfolio.unrealized / portfolio.cost) * 100).toFixed(1).replace('.', ',')}%)` : ''}
              </Text>
            </View>
            <View style={ui.row}>
              <Text style={ui.label}>Giá vốn → Giá trị</Text>
              <Text style={ui.text}>
                {format(portfolio.cost)} → {format(portfolio.value)}
              </Text>
            </View>
            {portfolio.realized !== 0 || portfolio.dividends !== 0 ? (
              <View style={ui.row}>
                <Text style={ui.label}>Đã chốt + cổ tức</Text>
                <Text style={[ui.text, { color: portfolio.realized + portfolio.dividends >= 0 ? colors.income : colors.expense }]}>
                  {portfolio.realized + portfolio.dividends >= 0 ? '+' : '-'}
                  {format(Math.abs(portfolio.realized + portfolio.dividends))}
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {hasMarketAssets ? (
          <Card>
            <View style={ui.row}>
              <Text style={[ui.label, { flex: 1 }]}>
                {priceNote || 'Giá cổ phiếu, crypto, vàng và ngoại tệ tự cập nhật mỗi 15 phút.'}
              </Text>
              <Button small variant="secondary" label="Cập nhật giá" icon="refresh" onPress={refresh} loading={pricesRefreshing} />
            </View>
          </Card>
        ) : null}

        {assets.length === 0 ? (
          <Card>
            <EmptyState
              icon="wallet"
              title="Chưa có tài sản"
              message="Thêm ví tiền mặt, tài khoản ngân hàng, sổ tiết kiệm, cổ phiếu, vàng hay khoản nợ để thấy toàn cảnh tài chính của bạn."
              actionLabel="Thêm tài sản"
              onAction={() => setFormOpen(true)}
            />
          </Card>
        ) : null}

        {used.length > 1 ? (
          <Chips
            options={[{ id: 'all', label: 'Tất cả', icon: null }, ...used]}
            value={filter}
            onChange={(id) => setFilter(id as CategoryId | 'all')}
          />
        ) : null}

        {shown.map((category) => {
          const items = assets.filter((a) => a.category === category.id).sort((a, b) => b.amount - a.amount);
          const total = items.reduce((sum, a) => sum + a.amount, 0);
          return (
            <Card key={category.id}>
              <CardHeader
                title={category.label}
                right={
                  <Text style={{ fontSize: font.body, fontWeight: '700', color: category.isLiability ? colors.expense : colors.text }}>
                    {category.isLiability ? '-' : ''}
                    {format(total)}
                  </Text>
                }
              />
              {items.map((a) => {
                const change = assetChange(a);
                return (
                  <ListItem
                    key={a.id}
                    leading={<CategoryBadge icon={getCategoryIcon(a.category)} color={category.color} />}
                    title={a.name}
                    subtitle={assetSubtitle(a, today)}
                    right={format(a.amount)}
                    rightColor={a.amount < 0 || category.isLiability ? colors.expense : undefined}
                    rightSub={change && change.direction !== 'flat' ? <ChangeBadge change={change} inverse={category.isLiability} /> : undefined}
                    onPress={() => nav.push({ name: 'asset', id: a.id })}
                    chevron
                  />
                );
              })}
            </Card>
          );
        })}
      </ScrollView>

      <AssetForm visible={formOpen} asset={null} onClose={() => setFormOpen(false)} />
    </View>
  );
}
