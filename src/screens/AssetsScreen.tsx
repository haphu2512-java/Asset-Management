import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AssetForm } from '../components/AssetForm';
import { CATEGORIES, formatVnd, summarize, type Asset } from '../finance';
import { useStore } from '../store';
import { colors, ui } from '../theme';

export function AssetsScreen() {
  const { assets, saveAsset, deleteAsset } = useStore();
  const [editing, setEditing] = useState<Asset | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const s = summarize(assets);

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
                  <Text style={ui.text}>{a.name}</Text>
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
