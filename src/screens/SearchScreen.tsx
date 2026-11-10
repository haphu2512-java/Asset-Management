import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { accountOptions } from '../components/accounts';
import { DateField } from '../components/DateField';
import { Chips, Field, Sheet } from '../components/Sheet';
import { TransactionRow } from '../components/TransactionRow';
import { AmountInput, Button, Card, EmptyState, Input, Segmented } from '../components/ui';
import { parseVndExpression, shiftDay, todayKey, type TransactionKind } from '../finance';
import { filterTransactions, type TransactionFilter } from '../ledger';
import { useStore } from '../store';
import { space, useMoney, useTheme } from '../theme';

type KindFilter = 'all' | TransactionKind;
type Period = 'all' | '7' | '30' | '90' | 'custom';
const ALL = 'all';
const PAGE = 50;

/** Find transactions by text, kind, category, wallet, amount and date. */
export function SearchScreen({ accountId: initialAccount }: { accountId?: string }) {
  const { colors, ui } = useTheme();
  const { transactions, categories, assets } = useStore();
  const format = useMoney();
  const today = todayKey();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [category, setCategory] = useState(ALL);
  const [account, setAccount] = useState(initialAccount ?? ALL);
  const [period, setPeriod] = useState<Period>('all');
  const [from, setFrom] = useState(shiftDay(today, -30));
  const [to, setTo] = useState(today);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const filter: TransactionFilter = useMemo(
    () => ({
      query,
      kind: kind === 'all' ? undefined : kind,
      categoryIds: category === ALL ? undefined : [category],
      accountId: account === ALL ? undefined : account,
      min: parseVndExpression(min) ?? undefined,
      max: parseVndExpression(max) ?? undefined,
      from: period === 'custom' ? from : period === 'all' ? undefined : shiftDay(today, -Number(period)),
      to: period === 'custom' ? to : undefined,
    }),
    [query, kind, category, account, min, max, period, from, to, today],
  );
  const results = useMemo(() => filterTransactions(transactions, filter, categories, assets), [transactions, filter, categories, assets]);
  const income = results.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = results.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);

  const categoryChoices = categories.filter((c) => !c.parentId && (kind === 'all' || kind === 'transfer' || c.kind === kind));
  const active = [category !== ALL, account !== ALL, period !== 'all', !!min.trim(), !!max.trim()].filter(Boolean).length;
  const reset = () => {
    setCategory(ALL);
    setAccount(ALL);
    setPeriod('all');
    setMin('');
    setMax('');
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Input
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setLimit(PAGE);
          }}
          placeholder="Tìm theo ghi chú, danh mục, tên ví"
          autoFocus={!initialAccount}
          returnKeyType="search"
          accessibilityLabel="Từ khoá tìm kiếm"
        />
        <Segmented
          options={[
            { id: 'all', label: 'Tất cả' },
            { id: 'expense', label: 'Chi' },
            { id: 'income', label: 'Thu' },
            { id: 'transfer', label: 'Chuyển' },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setCategory(ALL);
          }}
        />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            small
            variant={active > 0 ? 'primary' : 'secondary'}
            icon="filter"
            label={active > 0 ? `Bộ lọc (${active})` : 'Bộ lọc'}
            onPress={() => setFiltersOpen(true)}
            style={{ flex: 1 }}
          />
          {active > 0 ? <Button small variant="ghost" label="Xoá lọc" onPress={reset} /> : null}
        </View>

        <Card>
          <View style={ui.row}>
            <Text style={ui.label}>{results.length} giao dịch</Text>
            <Text style={ui.label}>
              <Text style={{ color: colors.income }}>+{format(income)}</Text>
              {'  '}
              <Text style={{ color: colors.expense }}>-{format(expense)}</Text>
            </Text>
          </View>
          {results.length === 0 ? (
            <EmptyState icon="search" title="Không tìm thấy giao dịch" message="Thử từ khoá khác hoặc nới bộ lọc." />
          ) : (
            results.slice(0, limit).map((t) => <TransactionRow key={t.id} transaction={t} showDate perspective={account === ALL ? undefined : account} />)
          )}
          {results.length > limit ? (
            <Button small variant="secondary" label={`Xem thêm (còn ${results.length - limit})`} onPress={() => setLimit(limit + PAGE)} />
          ) : null}
        </Card>
      </ScrollView>

      <Sheet visible={filtersOpen} title="Bộ lọc" onClose={() => setFiltersOpen(false)} onSave={() => setFiltersOpen(false)} saveLabel="Xem kết quả">
        <Field label="Thời gian" icon="calendar">
          <Chips
            options={[
              { id: 'all', label: 'Mọi lúc', icon: null },
              { id: '7', label: '7 ngày', icon: null },
              { id: '30', label: '30 ngày', icon: null },
              { id: '90', label: '90 ngày', icon: null },
              { id: 'custom', label: 'Tuỳ chọn', icon: null },
            ]}
            value={period}
            onChange={(id) => setPeriod(id as Period)}
          />
        </Field>
        {period === 'custom' ? (
          <>
            <Field label="Từ ngày">
              <DateField value={from} onChange={setFrom} accessibilityLabel="Từ ngày" />
            </Field>
            <Field label="Đến ngày">
              <DateField value={to} onChange={setTo} accessibilityLabel="Đến ngày" />
            </Field>
          </>
        ) : null}
        {kind !== 'transfer' ? (
          <Field label="Danh mục" icon="tag">
            <Chips
              options={[{ id: ALL, label: 'Tất cả', icon: null }, ...categoryChoices.map((c) => ({ id: c.id, label: c.label, color: c.color, icon: c.icon ?? c.id }))]}
              value={category}
              onChange={setCategory}
              showIcons
            />
          </Field>
        ) : null}
        <Field label="Ví / tài khoản" icon="wallet">
          <Chips options={[{ id: ALL, label: 'Tất cả', icon: null }, ...accountOptions(assets, account === ALL ? undefined : account)]} value={account} onChange={setAccount} showIcons />
        </Field>
        <Field label="Số tiền từ">
          <AmountInput value={min} onChangeText={setMin} placeholder="Ví dụ: 100k" accessibilityLabel="Số tiền tối thiểu" />
        </Field>
        <Field label="Số tiền đến">
          <AmountInput value={max} onChangeText={setMax} placeholder="Ví dụ: 5tr" accessibilityLabel="Số tiền tối đa" />
        </Field>
      </Sheet>
    </View>
  );
}
