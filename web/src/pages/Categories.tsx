import { useState } from 'react';
import type { FlowKind, TransactionCategory } from '@shared/finance';
import { useStore } from '@shared/store';
import { Badge } from '../components/Icon';
import { CategoryForm } from '../components/PlanningForms';
import { Button, Card, CardHeader, Segmented } from '../components/ui';

export function CategoriesPage() {
  const { categories } = useStore();
  const [kind, setKind] = useState<FlowKind>('expense');
  const [form, setForm] = useState<{ category: TransactionCategory | null } | null>(null);
  const roots = categories.filter((c) => c.kind === kind && !c.parentId);

  const row = (c: TransactionCategory, child = false) => (
    <button className="item" key={c.id} onClick={() => setForm({ category: c })} style={{ paddingLeft: child ? 36 : 4, opacity: c.hidden ? 0.5 : 1 }}>
      <Badge color={c.color} letter={c.label} />
      <span className="grow">
        <span className="title" style={{ display: 'block' }}>{c.label}</span>
        <span className="sub" style={{ display: 'block' }}>{[c.custom ? 'Tự tạo' : 'Mặc định', c.hidden ? 'đang ẩn' : null].filter(Boolean).join(' · ')}</span>
      </span>
    </button>
  );

  return (
    <>
      <Segmented
        options={[
          { id: 'expense', label: 'Chi tiêu' },
          { id: 'income', label: 'Thu nhập' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Card>
        <CardHeader title={kind === 'expense' ? 'Danh mục chi' : 'Danh mục thu'} icon="tag" right={<Button small icon="plus" label="Thêm danh mục" onClick={() => setForm({ category: null })} />} />
        <span className="label">Bấm vào danh mục để đổi tên, màu, ẩn đi hoặc chuyển thành danh mục con.</span>
        <div className="list">
          {roots.flatMap((c) => [row(c), ...categories.filter((x) => x.parentId === c.id).map((x) => row(x, true))])}
        </div>
      </Card>
      {form ? <CategoryForm category={form.category} kind={kind} onClose={() => setForm(null)} /> : null}
    </>
  );
}
