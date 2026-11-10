import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AssetForm } from '../components/AssetForm';
import { ChangeBadge } from '../components/ChangeBadge';
import { useComposer } from '../components/Composer';
import { Field, Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { TradeForm } from '../components/TradeForm';
import { TransactionRow } from '../components/TransactionRow';
import { AmountInput, Banner, Button, Card, CardHeader, EmptyState, LinkText, ListItem } from '../components/ui';
import {
  changeLabel,
  compareValue,
  formatDigits,
  getCategory,
  isHolding,
  isSpendable,
  parseVndExpression,
  todayKey,
} from '../finance';
import { interestInfo, performance, positionFromTrades, TRADE_LABEL, tradeCashFlow, type Trade } from '../investments';
import { accountTransactions } from '../ledger';
import { useNav } from '../nav';
import { useStore } from '../store';
import { font, useMoney, useTheme } from '../theme';
import { assetSubtitle } from './AssetsScreen';

const shortDate = (date: string) => {
  const [y, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
};
const formatQuantity = (n: number) => String(Math.round(n * 1e8) / 1e8).replace('.', ',');
const HISTORY_LIMIT = 30;

/** Everything about one asset: balance and history for accounts, cost basis and trades for holdings. */
export function AssetDetailScreen({ id }: { id: string }) {
  const { colors, ui } = useTheme();
  const { assets, transactions, trades, baseline, adjustBalance } = useStore();
  const nav = useNav();
  const composer = useComposer();
  const toast = useToast();
  const format = useMoney();
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustText, setAdjustText] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [tradeOpen, setTradeOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  const asset = assets.find((a) => a.id === id);
  const today = todayKey();
  const history = useMemo(() => accountTransactions(transactions, id), [transactions, id]);
  const ownTrades = useMemo(
    () => trades.filter((t) => t.assetId === id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [trades, id],
  );

  if (!asset) {
    return (
      <View style={ui.screen}>
        <EmptyState icon="wallet" title="Tài sản không còn tồn tại" message="Tài sản này đã bị xoá." actionLabel="Quay lại" onAction={nav.pop} />
      </View>
    );
  }

  const category = getCategory(asset.category);
  const holding = isHolding(asset) || ownTrades.length > 0;
  const change = baseline && asset.id in baseline.amounts ? compareValue(asset.amount, baseline.amounts[asset.id]) : null;
  const interest = interestInfo(asset, today);
  const perf = ownTrades.length > 0 ? performance(positionFromTrades(ownTrades), asset.amount) : null;
  const unit = asset.category === 'gold' ? 'chỉ' : (asset.symbol ?? '');
  const pnlColor = (n: number) => (n >= 0 ? colors.income : colors.expense);
  const signed = (n: number) => `${n >= 0 ? '+' : '-'}${format(Math.abs(n))}`;

  const openTrade = (trade: Trade | null) => {
    setEditingTrade(trade);
    setTradeOpen(true);
  };

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
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Card>
          <Text style={ui.label}>
            {category.label}
            {category.isLiability ? ' · số tiền còn nợ' : ''}
          </Text>
          <Text style={[ui.big, (asset.amount < 0 || category.isLiability) && { color: colors.expense }]}>{format(asset.amount)}</Text>
          {assetSubtitle(asset, today) ? <Text style={ui.label}>{assetSubtitle(asset, today)}</Text> : null}
          {change ? <ChangeBadge change={change} inverse={category.isLiability} label={baseline ? changeLabel(baseline.date, today) : undefined} /> : null}
          {asset.amount < 0 && !category.isLiability ? (
            <Banner tone="warning">Số dư đang âm: đã chi nhiều hơn số tiền ghi nhận. Hãy điều chỉnh số dư cho khớp thực tế.</Banner>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {holding ? (
              <Button small label="Thêm lệnh" icon="plus" onPress={() => openTrade(null)} />
            ) : (
              <>
                {asset.category === 'debt' ? (
                  <Button small label="Trả nợ" icon="transfer" onPress={() => composer.open({ kind: 'transfer', toAccountId: asset.id, accountId: '', note: `Trả nợ: ${asset.name}` })} />
                ) : asset.category === 'lent' ? (
                  <Button small label="Thu nợ" icon="transfer" onPress={() => composer.open({ kind: 'transfer', accountId: asset.id, note: `Thu nợ: ${asset.name}` })} />
                ) : (
                  <Button small label="Chuyển khoản" icon="transfer" onPress={() => composer.open({ kind: 'transfer', accountId: asset.id })} />
                )}
                <Button
                  small
                  variant="secondary"
                  label="Điều chỉnh số dư"
                  icon="adjust"
                  onPress={() => {
                    setAdjustText(formatDigits(asset.amount));
                    setAdjustError('');
                    setAdjustOpen(true);
                  }}
                />
              </>
            )}
            <Button small variant="secondary" label="Sửa" icon="edit" onPress={() => setEditOpen(true)} />
          </View>
        </Card>

        {interest ? (
          <Card>
            <CardHeader title={asset.category === 'saving' ? 'Tiền lãi' : 'Lãi phát sinh'} icon="trending-up" />
            <View style={ui.row}>
              <Text style={ui.label}>Lãi tính đến hôm nay</Text>
              <Text style={[ui.text, { fontWeight: '700', color: category.isLiability ? colors.expense : colors.income }]}>{format(interest.accrued)}</Text>
            </View>
            {interest.atMaturity !== null ? (
              <View style={ui.row}>
                <Text style={ui.label}>{asset.category === 'saving' ? 'Lãi dự kiến khi đáo hạn' : 'Lãi đến ngày đến hạn'}</Text>
                <Text style={[ui.text, { fontWeight: '600' }]}>{format(interest.atMaturity)}</Text>
              </View>
            ) : null}
            {interest.daysLeft !== null && asset.dueDate ? (
              <Text style={[ui.label, interest.daysLeft < 0 && { color: colors.expense }]}>
                {interest.daysLeft > 0
                  ? `Còn ${interest.daysLeft} ngày đến ${shortDate(asset.dueDate)}.`
                  : interest.daysLeft === 0
                    ? 'Đến hạn hôm nay.'
                    : `Đã quá hạn ${-interest.daysLeft} ngày.`}
              </Text>
            ) : null}
            <Text style={ui.label}>Lãi đơn, tính theo ngày trên số dư hiện tại; con số thực tế tuỳ ngân hàng.</Text>
          </Card>
        ) : null}

        {holding ? (
          <Card>
            <CardHeader title="Giá vốn và lãi/lỗ" icon="scale" />
            {perf && perf.costBasis > 0 ? (
              <>
                <View style={ui.row}>
                  <Text style={ui.label}>Lãi/lỗ chưa chốt</Text>
                  <Text style={{ fontSize: font.bodyLarge, fontWeight: '700', color: pnlColor(perf.unrealized) }}>
                    {signed(perf.unrealized)}
                    {perf.unrealizedPercent !== null ? ` (${perf.unrealizedPercent.toFixed(2).replace('.', ',')}%)` : ''}
                  </Text>
                </View>
                <View style={ui.row}>
                  <Text style={ui.label}>Giá vốn trung bình</Text>
                  <Text style={ui.text}>
                    {format(Math.round(perf.averageCost))} / {unit || 'đơn vị'}
                  </Text>
                </View>
                <View style={ui.row}>
                  <Text style={ui.label}>Tổng vốn đang nắm giữ</Text>
                  <Text style={ui.text}>{format(perf.costBasis)}</Text>
                </View>
              </>
            ) : (
              <Text style={ui.label}>
                {perf ? 'Không còn nắm giữ đơn vị nào.' : 'Chưa có giá vốn. Thêm lệnh mua với giá bạn đã mua để app tính lãi/lỗ.'}
              </Text>
            )}
            {perf && perf.realized !== 0 ? (
              <View style={ui.row}>
                <Text style={ui.label}>Lãi/lỗ đã chốt</Text>
                <Text style={[ui.text, { color: pnlColor(perf.realized), fontWeight: '600' }]}>{signed(perf.realized)}</Text>
              </View>
            ) : null}
            {perf && perf.dividends !== 0 ? (
              <View style={ui.row}>
                <Text style={ui.label}>Cổ tức đã nhận</Text>
                <Text style={[ui.text, { color: colors.income, fontWeight: '600' }]}>{signed(perf.dividends)}</Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {holding ? (
          <Card>
            <CardHeader title="Lịch sử mua bán" icon="clock" right={<Text style={ui.label}>{ownTrades.length} lệnh</Text>} />
            {ownTrades.length === 0 ? (
              <Text style={ui.label}>Chưa có lệnh nào.</Text>
            ) : (
              ownTrades.map((t) => {
                const cash = tradeCashFlow(t);
                return (
                  <ListItem
                    key={t.id}
                    title={`${TRADE_LABEL[t.side]}${t.quantity ? ` ${formatQuantity(t.quantity)} ${unit}` : ''}`}
                    subtitle={[shortDate(t.date), t.side !== 'dividend' && t.side !== 'bonus' ? `giá ${formatDigits(t.price)} ₫` : null, t.note].filter(Boolean).join(' · ')}
                    right={cash !== 0 ? signed(cash) : undefined}
                    rightColor={cash > 0 ? colors.income : colors.text}
                    onPress={() => openTrade(t)}
                  />
                );
              })
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader
              title="Lịch sử"
              icon="clock"
              right={
                history.length > HISTORY_LIMIT ? (
                  <LinkText label="Xem tất cả" onPress={() => nav.push({ name: 'search', accountId: asset.id })} />
                ) : (
                  <Text style={ui.label}>{history.length} giao dịch</Text>
                )
              }
            />
            {history.length === 0 ? (
              <Text style={ui.label}>
                {isSpendable(asset)
                  ? 'Chưa có giao dịch nào gắn với ví này. Khi thêm thu chi, hãy chọn ví để số dư tự cập nhật.'
                  : 'Chưa có giao dịch chuyển tiền nào với tài khoản này.'}
              </Text>
            ) : (
              history.slice(0, HISTORY_LIMIT).map((t) => <TransactionRow key={t.id} transaction={t} showDate perspective={asset.id} />)
            )}
          </Card>
        )}
      </ScrollView>

      <AssetForm visible={editOpen} asset={asset} onClose={() => setEditOpen(false)} onDeleted={nav.pop} />
      <TradeForm visible={tradeOpen} asset={asset} trade={editingTrade} onClose={() => setTradeOpen(false)} />
      <Sheet visible={adjustOpen} title="Điều chỉnh số dư" onClose={() => setAdjustOpen(false)} onSave={saveAdjust} error={adjustError}>
        <Field
          label={category.isLiability ? 'Số tiền thực tế còn nợ (VND)' : 'Số dư thực tế (VND)'}
          hint="Phần chênh lệch so với số trong app được ghi thành một dòng “Điều chỉnh số dư”, không tính vào thu hay chi."
        >
          <AmountInput value={adjustText} onChangeText={setAdjustText} placeholder="Ví dụ: 2.350.000" autoFocus accessibilityLabel="Số dư thực tế" />
        </Field>
      </Sheet>
    </View>
  );
}
