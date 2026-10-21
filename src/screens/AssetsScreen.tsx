import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { AssetForm } from '../components/AssetForm';
import { CATEGORIES, formatDigits, formatVnd, isMarketPriced, summarize, type Asset } from '../finance';
import { useStore } from '../store';
import { colors, ui } from '../theme';

export function AssetsScreen() {
  const { assets, saveAsset, deleteAsset, refreshMarketPrices, pricesRefreshing } = useStore();
  const [editing, setEditing] = useState<Asset | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [priceNote, setPriceNote] = useState('');
  const s = summarize(assets);
  const hasMarketAssets = assets.some(isMarketPriced);

  const refresh = async () => {
    setPriceNote('');
    try {
      const missing = await refreshMarketPrices();
      if (missing.length > 0) setPriceNote(`Không tìm thấy giá cho: ${missing.join(', ')}. Hãy kiểm tra lại mã.`);
    } catch {
      setPriceNote('Không cập nhật được giá. Hãy kiểm tra kết nối mạng.');
    }
  };

  const open = (asset: Asset | null) => {
    setEditing(asset);
    setFormOpen(true);
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        {assets.length === 0 ? (
          <View style={ui.card}>
            <Text style={ui.heading}>Chưa có tài sản nào</Text>
            <Text style={ui.label}>
              Bấm nút + để thêm tiền mặt, cổ phiếu, crypto, khoản cho vay hoặc khoản đang nợ.
            </Text>
          </View>
        ) : null}
        {hasMarketAssets ? (
          <View style={ui.card}>
            <View style={ui.row}>
              <Text style={ui.label}>{lastPriceUpdate(assets)}</Text>
              <Pressable onPress={refresh} disabled={pricesRefreshing} hitSlop={8}>
                {pricesRefreshing ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Cập nhật giá</Text>
                )}
              </Pressable>
            </View>
            {priceNote ? <Text style={{ color: colors.expense, fontSize: 13 }}>{priceNote}</Text> : null}
          </View>
        ) : null}
        {CATEGORIES.map((category) => {
          const items = assets.filter((a) => a.category === category.id);
          if (items.length === 0) return null;
          const total = s.byCategory.find((c) => c.category.id === category.id)?.amount ?? 0;
          return (
            <View key={category.id} style={ui.card}>
              <View style={ui.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[ui.dot, { backgroundColor: category.color }]} />
                  <Text style={ui.heading}>{category.label}</Text>
                </View>
                <Text style={[ui.heading, category.isLiability && { color: colors.expense }]}>
                  {category.isLiability ? '-' : ''}
                  {formatVnd(total)}
                </Text>
              </View>
              {items.map((a) => (
                <Pressable key={a.id} onPress={() => open(a)} style={[ui.row, { paddingVertical: 6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={ui.text}>{a.name}</Text>
                    {isMarketPriced(a) ? (
                      <Text style={ui.label}>
                        {a.price
                          ? `${formatQuantity(a.quantity!)} ${a.symbol} × ${formatVnd(a.price)}`
                          : `${formatQuantity(a.quantity!)} ${a.symbol} · đang chờ giá`}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={ui.text}>{formatVnd(a.amount)}</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
        {assets.length > 0 ? (
          <View style={ui.card}>
            <View style={ui.row}>
              <Text style={ui.text}>Tổng tài sản</Text>
              <Text style={ui.text}>{formatVnd(s.totalAssets)}</Text>
            </View>
            <View style={ui.row}>
              <Text style={ui.text}>Tổng nợ</Text>
              <Text style={[ui.text, { color: colors.expense }]}>-{formatVnd(s.totalDebt)}</Text>
            </View>
            <View style={ui.row}>
              <Text style={ui.heading}>Tài sản ròng</Text>
              <Text style={ui.heading}>{formatVnd(s.netWorth)}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <Pressable style={ui.fab} onPress={() => open(null)} accessibilityLabel="Thêm tài sản">
        <Text style={ui.fabText}>+</Text>
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
  return `Giá cập nhật lúc ${hh}:${mm} ${d.getDate()}/${d.getMonth() + 1}`;
}
