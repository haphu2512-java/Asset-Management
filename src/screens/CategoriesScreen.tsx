import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { getCategoryIcon } from '../components/Icon';
import { CategoryForm } from '../components/PlanningForms';
import { Button, Card, CategoryBadge, ListItem, Segmented } from '../components/ui';
import { type FlowKind, type TransactionCategory } from '../finance';
import { useStore } from '../store';
import { useTheme } from '../theme';

/** Income and expense categories: rename, recolour, hide, and add your own (with sub-categories). */
export function CategoriesScreen() {
  const { ui } = useTheme();
  const { categories } = useStore();
  const [kind, setKind] = useState<FlowKind>('expense');
  const [editing, setEditing] = useState<TransactionCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const roots = categories.filter((c) => c.kind === kind && !c.parentId);
  const open = (category: TransactionCategory | null) => {
    setEditing(category);
    setFormOpen(true);
  };
  const row = (c: TransactionCategory, child: boolean) => (
    <View key={c.id} style={child ? { marginLeft: 28 } : undefined}>
      <ListItem
        leading={<CategoryBadge icon={getCategoryIcon(c.icon ?? c.id)} color={c.color} size={child ? 30 : 36} />}
        title={c.label}
        subtitle={[c.custom ? 'Tự tạo' : null, c.hidden ? 'Đang ẩn' : null].filter(Boolean).join(' · ') || undefined}
        onPress={() => open(c)}
        chevron
        accessibilityLabel={`Danh mục ${c.label}${c.hidden ? ', đang ẩn' : ''}. Chạm để sửa`}
      />
    </View>
  );

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Segmented
          options={[
            { id: 'expense', label: 'Khoản chi', icon: 'arrow-up' },
            { id: 'income', label: 'Khoản thu', icon: 'arrow-down' },
          ]}
          value={kind}
          onChange={setKind}
        />
        <Card>
          {roots.map((c) => [row(c, false), ...categories.filter((s) => s.parentId === c.id).map((s) => row(s, true))])}
          <Button small variant="secondary" label="Thêm danh mục" icon="plus" onPress={() => open(null)} />
        </Card>
        <Text style={ui.label}>
          Danh mục ẩn không còn xuất hiện khi nhập giao dịch mới, nhưng giao dịch cũ vẫn được giữ nguyên trong báo cáo.
        </Text>
      </ScrollView>
      <CategoryForm visible={formOpen} category={editing} kind={kind} onClose={() => setFormOpen(false)} />
    </View>
  );
}
