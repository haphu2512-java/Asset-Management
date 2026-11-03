import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { AssetForm } from '../components/AssetForm';
import { ChangeBadge } from '../components/ChangeBadge';
import { CategoryBadge, getCategoryIcon, Icon } from '../components/Icon';
import {
  CATEGORIES,
  changeLabel,
  compareValue,
  formatDigits,
  formatVnd,
  isMarketPriced,
  summarize,
  todayKey,
  type Asset,
  type CategoryId,
} from '../finance';
import { useStore } from '../store';
import { colors, ui } from '../theme';

export function AssetsScreen() {
  const { assets, baseline, saveAsset, deleteAsset, refreshMarketPrices, pricesRefreshing } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [editing, setEditing] = useState<Asset | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [priceNote, setPriceNote] = useState('');

  const s = summarize(assets);
  const hasMarketAssets = assets.some(isMarketPriced);
  const netWorthChange = baseline ? compareValue(s.netWorth, baseline.netWorth) : null;
  /** Change of one holding since the baseline; null for holdings added since then. */
  const assetChange = (a: Asset) =>
    baseline && a.id in baseline.amounts ? compareValue(a.amount, baseline.amounts[a.id]) : null;

  const refresh = async () => {
    setPriceNote('');
    try {
      const missing = await refreshMarketPrices();
      if (missing.length > 0) setPriceNote(`Không tìm thấy giá: ${missing.join(', ')}.`);
    } catch {
      setPriceNote('Lỗi mạng khi cập nhật giá.');
    }
  };

  const open = (asset: Asset | null) => {
    setEditing(asset);
    setFormOpen(true);
  };

  // Group by category to show
  const categoriesToShow = selectedCategory === 'all'
    ? CATEGORIES.filter((c) => assets.some((a) => a.category === c.id))
    : CATEGORIES.filter((c) => c.id === selectedCategory);

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} showsVerticalScrollIndicator={false}>
        {/* 1. Hero Card: Tổng quan Tài sản ròng & Tóm tắt */}
        {assets.length > 0 ? (
          <View style={[ui.card, { padding: 16 }]}>
            <View style={[ui.row, { marginBottom: 4 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="shield" size={15} color={colors.primary} />
                <Text style={[ui.label, { fontWeight: '700', letterSpacing: 0.5 }]}>
                  TÀI SẢN RÒNG (NET WORTH)
                </Text>
              </View>

              {hasMarketAssets ? (
                <Pressable
                  onPress={refresh}
                  disabled={pricesRefreshing}
                  hitSlop={8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: colors.primaryLight,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: `${colors.primary}25`,
                  }}
                >
                  {pricesRefreshing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Icon name="refresh" size={11} color={colors.primary} />
                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                        Cập nhật giá
                      </Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>

            <Text
              style={[
                ui.big,
                { fontSize: 26, letterSpacing: -0.5, marginVertical: 4 },
                s.netWorth < 0 && { color: colors.expense },
              ]}
            >
              {formatVnd(s.netWorth)}
            </Text>
            <ChangeBadge
              change={netWorthChange}
              label={baseline ? changeLabel(baseline.date, todayKey()) : undefined}
            />

            {/* Quick 2-Column Stats: Tổng tài sản vs Tổng nợ */}
            <View
              style={{
                flexDirection: 'row',
                marginTop: 10,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: colors.borderSubtle,
                gap: 12,
              }}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#DCFCE7',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="trending-up" size={15} color={colors.income} />
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: colors.muted }}>Tổng tài sản</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                    {formatVnd(s.totalAssets)}
                  </Text>
                </View>
              </View>

              <View style={{ width: 1, backgroundColor: colors.borderSubtle }} />

              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: s.totalDebt > 0 ? '#FEE2E2' : '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name="debt"
                    size={15}
                    color={s.totalDebt > 0 ? colors.expense : colors.muted}
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: colors.muted }}>Tổng nợ</Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: s.totalDebt > 0 ? colors.expense : colors.muted,
                    }}
                  >
                    {s.totalDebt > 0 ? `-${formatVnd(s.totalDebt)}` : '0 ₫'}
                  </Text>
                </View>
              </View>
            </View>

            {hasMarketAssets ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                <Icon name="clock" size={11} color={colors.muted} />
                <Text style={{ fontSize: 11, color: colors.muted }}>{lastPriceUpdate(assets)}</Text>
                {priceNote ? (
                  <Text style={{ fontSize: 11, color: colors.expense, marginLeft: 4 }}>
                    • {priceNote}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 2. Thanh lọc danh mục ngang (Horizontal Category Filter Chips) */}
        {assets.length > 0 ? (
          <View style={{ marginVertical: 2 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
            >
              <Pressable
                onPress={() => setSelectedCategory('all')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: selectedCategory === 'all' ? colors.primary : colors.border,
                  backgroundColor: selectedCategory === 'all' ? colors.primary : colors.card,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: selectedCategory === 'all' ? '600' : '500',
                    color: selectedCategory === 'all' ? '#FFFFFF' : colors.text,
                  }}
                >
                  Tất cả ({assets.length})
                </Text>
              </Pressable>

              {CATEGORIES.map((category) => {
                const count = assets.filter((a) => a.category === category.id).length;
                if (count === 0) return null;
                const isSelected = selectedCategory === category.id;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => setSelectedCategory(category.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 11,
                      paddingVertical: 6,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primaryLight : colors.card,
                    }}
                  >
                    <Icon
                      name={getCategoryIcon(category.id)}
                      size={13}
                      color={isSelected ? colors.primary : category.color}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? '600' : '500',
                        color: isSelected ? colors.primary : colors.text,
                      }}
                    >
                      {category.label} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* 3. Danh sách tài sản nhóm gọn gàng */}
        {assets.length === 0 ? (
          <View style={[ui.card, { alignItems: 'center', paddingVertical: 36, gap: 10 }]}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: colors.primaryLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="assets" size={26} color={colors.primary} />
            </View>
            <Text style={[ui.heading, { fontSize: 16 }]}>Chưa có tài sản nào</Text>
            <Text style={[ui.label, { textAlign: 'center', maxWidth: 260, lineHeight: 18 }]}>
              Bấm nút [+] ở góc phải dưới để thêm tiền mặt, ngân hàng, cổ phiếu, crypto, cho vay hoặc khoản nợ.
            </Text>
          </View>
        ) : null}

        {categoriesToShow.map((category) => {
          const items = assets.filter((a) => a.category === category.id);
          if (items.length === 0) return null;
          const total = s.byCategory.find((c) => c.category.id === category.id)?.amount ?? 0;

          return (
            <View key={category.id} style={ui.card}>
              {/* Header danh mục tinh gọn */}
              <View
                style={[
                  ui.row,
                  { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <CategoryBadge
                    icon={getCategoryIcon(category.id)}
                    color={category.color}
                    size={26}
                    iconSize={13}
                  />
                  <Text style={[ui.heading, { fontSize: 13.5 }]}>{category.label}</Text>
                  <View
                    style={{
                      backgroundColor: colors.borderSubtle,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>
                      {items.length}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    ui.heading,
                    { fontSize: 13.5 },
                    category.isLiability && { color: colors.expense },
                  ]}
                >
                  {category.isLiability ? '-' : ''}
                  {formatVnd(total)}
                </Text>
              </View>

              {/* Các tài sản trong danh mục */}
              {items.map((a, idx) => {
                const change = assetChange(a);
                return (
                <Pressable
                  key={a.id}
                  onPress={() => open(a)}
                  style={({ pressed }) => [
                    ui.row,
                    {
                      paddingVertical: 10,
                      borderTopWidth: idx > 0 ? 1 : 0,
                      borderTopColor: colors.borderSubtle,
                      opacity: pressed ? 0.65 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[ui.text, { fontWeight: '600', fontSize: 14 }]}>{a.name}</Text>
                    {isMarketPriced(a) ? (
                      <Text style={[ui.label, { fontSize: 12, marginTop: 2 }]}>
                        {a.price
                          ? `${formatQuantity(a.quantity!)} ${a.symbol} × ${formatVnd(a.price)}`
                          : `${formatQuantity(a.quantity!)} ${a.symbol} · đang chờ giá`}
                      </Text>
                    ) : (
                      <Text style={[ui.label, { fontSize: 12, marginTop: 2 }]}>
                        {category.label}
                      </Text>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text
                        style={[
                          ui.text,
                          { fontWeight: '700', fontSize: 14 },
                          category.isLiability && { color: colors.expense },
                        ]}
                      >
                        {category.isLiability ? '-' : ''}
                        {formatVnd(a.amount)}
                      </Text>
                      {change && change.direction !== 'flat' ? (
                        <ChangeBadge change={change} size="small" inverse={category.isLiability} />
                      ) : null}
                    </View>
                    <Icon name="chevron-right" size={13} color={colors.muted} />
                  </View>
                </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Nút FAB thêm tài sản */}
      <Pressable style={ui.fab} onPress={() => open(null)} accessibilityLabel="Thêm tài sản">
        <Icon name="plus" size={22} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>

      <AssetForm
        visible={formOpen}
        asset={editing}
        onClose={() => setFormOpen(false)}
        onSave={saveAsset}
        onDelete={deleteAsset}
      />
    </View>
  );
}

function formatQuantity(quantity: number): string {
  const [whole, fraction] = String(quantity).split('.');
  return formatDigits(Number(whole)) + (fraction ? `,${fraction}` : '');
}

function lastPriceUpdate(assets: Asset[]): string {
  const times = assets
    .filter(isMarketPriced)
    .map((a) => (a.priceUpdatedAt ? Date.parse(a.priceUpdatedAt) : 0))
    .filter((t) => t > 0);
  if (times.length === 0) return 'Chưa có giá thị trường';
  const d = new Date(Math.min(...times));
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `Cập nhật: ${hh}:${mm} ${d.getDate()}/${d.getMonth() + 1}`;
}
