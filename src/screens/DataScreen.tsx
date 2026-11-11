import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useToast } from '../components/Toast';
import { Banner, Button, Card, CardHeader, Segmented } from '../components/ui';
import { CSV_HEADER, importCsv, toCsv, type CsvImport } from '../csv';
import { todayKey, type Transaction } from '../finance';
import { newId, useStore } from '../store';
import { useMoney, useTheme } from '../theme';

type Scope = 'all' | 'year' | 'month';

const sameEntry = (a: Omit<Transaction, 'id'>, b: Transaction) =>
  a.date === b.date && a.kind === b.kind && a.amount === b.amount && a.note === b.note && a.category === b.category;

/** Saves CSV text as a file the user can keep: a download on the web, the share sheet on phones. */
async function deliver(name: string, csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const g = globalThis as unknown as {
      document: { createElement: (tag: string) => { href: string; download: string; click: () => void } };
      URL: { createObjectURL: (blob: Blob) => string; revokeObjectURL: (url: string) => void };
    };
    const url = g.URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = g.document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    g.URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Thiết bị này không hỗ trợ chia sẻ file.');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Lưu file CSV', UTI: 'public.comma-separated-values-text' });
}

/** Export transactions to CSV and import them back, also from other apps or Excel. */
export function DataScreen() {
  const { ui } = useTheme();
  const { transactions, categories, assets, saveTransactions, deleteTransaction } = useStore();
  const toast = useToast();
  const format = useMoney();
  const today = todayKey();
  const [scope, setScope] = useState<Scope>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<(CsvImport & { fileName: string; duplicates: number }) | null>(null);

  const selected = transactions.filter((t) =>
    scope === 'all' ? true : scope === 'year' ? t.date.slice(0, 4) === today.slice(0, 4) : t.date.slice(0, 7) === today.slice(0, 7),
  );

  const exportCsv = async () => {
    setError('');
    if (selected.length === 0) return setError('Không có giao dịch nào trong khoảng thời gian này.');
    setBusy(true);
    try {
      await deliver(`thu-chi-${today}.csv`, toCsv(selected, categories, assets));
      toast.show({ message: `Đã xuất ${selected.length} giao dịch.`, tone: 'success' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xuất được file.');
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    setError('');
    setPreview(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const parsed = importCsv(text, categories, assets);
      const fresh = parsed.entries.filter((e) => !transactions.some((t) => sameEntry(e, t)));
      setPreview({ entries: fresh, errors: parsed.errors, fileName: asset.name, duplicates: parsed.entries.length - fresh.length });
    } catch (e) {
      console.warn('CSV import failed:', e);
      setError('Không đọc được file. Hãy chọn file CSV (UTF-8).');
    }
  };

  const confirmImport = () => {
    if (!preview || preview.entries.length === 0) return;
    const rows = preview.entries.map((e) => ({ ...e, id: newId() }));
    saveTransactions(rows);
    setPreview(null);
    toast.show({
      message: `Đã nhập ${rows.length} giao dịch.`,
      tone: 'success',
      actionLabel: 'Hoàn tác',
      onAction: () => rows.forEach((r) => deleteTransaction(r.id)),
    });
  };

  const total = (kind: Transaction['kind']) => preview?.entries.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      {error ? (
        <Banner tone="danger" onPress={() => setError('')}>
          {error}
        </Banner>
      ) : null}

      <Card>
        <CardHeader title="Xuất giao dịch ra CSV" icon="download" />
        <Text style={ui.label}>File mở được bằng Excel và Google Sheets, dùng để sao lưu hoặc làm báo cáo riêng.</Text>
        <Segmented
          options={[
            { id: 'all', label: 'Tất cả' },
            { id: 'year', label: 'Năm nay' },
            { id: 'month', label: 'Tháng này' },
          ]}
          value={scope}
          onChange={setScope}
        />
        <Button label={`Xuất ${selected.length} giao dịch`} icon="download" onPress={exportCsv} loading={busy} disabled={selected.length === 0} />
      </Card>

      <Card>
        <CardHeader title="Nhập giao dịch từ CSV" icon="upload" />
        <Text style={ui.label}>
          File cần có dòng tiêu đề với ít nhất cột "Ngày" và "Số tiền". Các cột được nhận: {CSV_HEADER.join(', ')}. Số âm được
          hiểu là khoản chi. Tên ví phải trùng với ví trong app thì mới được gắn vào ví.
        </Text>
        <Button variant="secondary" label="Chọn file CSV" icon="upload" onPress={pick} />

        {preview ? (
          <View style={{ gap: 8 }}>
            <Text style={ui.heading}>{preview.fileName}</Text>
            <Text style={ui.text}>
              Sẽ nhập {preview.entries.length} giao dịch: thu {format(total('income'))}, chi {format(total('expense'))}
              {total('transfer') > 0 ? `, chuyển khoản ${format(total('transfer'))}` : ''}.
            </Text>
            {preview.duplicates > 0 ? (
              <Banner tone="info">Bỏ qua {preview.duplicates} dòng trùng với giao dịch đã có trong app.</Banner>
            ) : null}
            {preview.errors.length > 0 ? (
              <Banner tone="warning">
                {`Bỏ qua ${preview.errors.length} dòng lỗi:\n${preview.errors.slice(0, 5).join('\n')}${preview.errors.length > 5 ? '\n…' : ''}`}
              </Banner>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button variant="secondary" label="Huỷ" onPress={() => setPreview(null)} style={{ flex: 1 }} />
              <Button label="Nhập vào app" icon="check" onPress={confirmImport} disabled={preview.entries.length === 0} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}
