import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { importCsv, toCsv, type CsvImport } from '@shared/csv';
import { todayKey, type Transaction } from '@shared/finance';
import { usePrefs, type ThemeMode } from '@shared/prefs';
import { newId, useStore } from '@shared/store';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Banner, Button, Card, CardHeader, Field, Modal, Segmented, Toggle } from '../components/ui';
import { useMoney } from '../hooks';
import { supabase } from '../supabase';

type Scope = 'all' | 'year' | 'month';

const sameEntry = (a: Omit<Transaction, 'id'>, b: Transaction) =>
  a.date === b.date && a.kind === b.kind && a.amount === b.amount && a.note === b.note && a.category === b.category;

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DataCards() {
  const { transactions, categories, assets, saveTransactions, deleteTransaction } = useStore();
  const toast = useToast();
  const format = useMoney();
  const today = todayKey();
  const [scope, setScope] = useState<Scope>('all');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<(CsvImport & { fileName: string; duplicates: number }) | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const selected = transactions.filter((t) =>
    scope === 'all' ? true : scope === 'year' ? t.date.slice(0, 4) === today.slice(0, 4) : t.date.slice(0, 7) === today.slice(0, 7),
  );

  const pick = async (picked: File) => {
    setError('');
    setPreview(null);
    try {
      const parsed = importCsv(await picked.text(), categories, assets);
      const fresh = parsed.entries.filter((e) => !transactions.some((t) => sameEntry(e, t)));
      setPreview({ entries: fresh, errors: parsed.errors, fileName: picked.name, duplicates: parsed.entries.length - fresh.length });
    } catch {
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
    <>
      <Card>
        <CardHeader title="Xuất giao dịch ra CSV" icon="download" />
        <span className="label">File mở được bằng Excel và Google Sheets, dùng để sao lưu hoặc làm báo cáo riêng.</span>
        <Segmented
          options={[
            { id: 'all', label: 'Tất cả' },
            { id: 'year', label: 'Năm nay' },
            { id: 'month', label: 'Tháng này' },
          ]}
          value={scope}
          onChange={setScope}
        />
        <Button
          label={`Xuất ${selected.length} giao dịch`}
          icon="download"
          disabled={selected.length === 0}
          onClick={() => {
            download(`thu-chi-${today}.csv`, toCsv(selected, categories, assets));
            toast.show({ message: `Đã xuất ${selected.length} giao dịch.`, tone: 'success' });
          }}
        />
      </Card>
      <Card>
        <CardHeader title="Nhập giao dịch từ CSV" icon="upload" />
        <span className="label">
          File cần có cột <strong>Ngày</strong> và <strong>Số tiền</strong>; có thể thêm Loại, Danh mục, Ghi chú, Ví. Số tiền âm được hiểu là khoản chi. Giao dịch trùng với dữ liệu
          đang có sẽ được bỏ qua.
        </span>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button variant="secondary" label="Chọn file CSV" icon="upload" onClick={() => file.current?.click()} />
        <input
          ref={file}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = '';
            if (picked) pick(picked);
          }}
        />
        {preview ? (
          <div className="stack">
            <Banner tone={preview.entries.length > 0 ? 'info' : 'warning'}>
              <span>
                <strong>{preview.fileName}</strong>: {preview.entries.length} giao dịch mới
                {preview.entries.length > 0 ? ` (thu ${format(total('income'))}, chi ${format(total('expense'))}${total('transfer') > 0 ? `, chuyển khoản ${format(total('transfer'))}` : ''})` : ''}
                {preview.duplicates > 0 ? `, bỏ qua ${preview.duplicates} giao dịch đã có` : ''}.
              </span>
            </Banner>
            {preview.errors.length > 0 ? (
              <Banner tone="warning">
                <div>
                  {preview.errors.slice(0, 5).map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                  {preview.errors.length > 5 ? <div>…và {preview.errors.length - 5} dòng khác.</div> : null}
                </div>
              </Banner>
            ) : null}
            <div className="row">
              <Button variant="secondary" label="Huỷ" onClick={() => setPreview(null)} />
              <Button label="Nhập vào app" icon="check" disabled={preview.entries.length === 0} onClick={confirmImport} />
            </div>
          </div>
        ) : null}
      </Card>
    </>
  );
}

const MANAGE = [
  { to: '/budgets', label: 'Ngân sách', icon: 'budget' },
  { to: '/recurring', label: 'Giao dịch định kỳ', icon: 'clock' },
  { to: '/categories', label: 'Danh mục thu chi', icon: 'tag' },
  { to: '/reports', label: 'Báo cáo', icon: 'chart' },
  { to: '/advisor', label: 'Cố vấn AI', icon: 'sparkle' },
];

export function SettingsPage() {
  const { user, pendingCount, syncNow, signOut, deleteAccount } = useStore();
  const { prefs, setPrefs } = usePrefs();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [signOutOpen, setSignOutOpen] = useState(false);

  const sync = async () => {
    setSyncing(true);
    await syncNow();
    setSyncing(false);
    toast.show({ message: 'Đã đồng bộ xong.', tone: 'success' });
  };

  const changePassword = async () => {
    if (password.length < 6) return setPasswordError('Mật khẩu cần ít nhất 6 ký tự.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setPasswordError('Không đổi được mật khẩu. Hãy kiểm tra kết nối và thử lại.');
    setPasswordOpen(false);
    setPassword('');
    toast.show({ message: 'Đã đổi mật khẩu.', tone: 'success' });
  };

  const removeAccount = async () => {
    if (deleteText.trim().toUpperCase() !== 'XOA') return setDeleteError('Hãy gõ XOA để xác nhận.');
    const error = await deleteAccount();
    if (error) return setDeleteError(error);
    setDeleteOpen(false);
  };

  return (
    <>
      <div className="grid-2">
        <Card>
          <CardHeader title="Tài khoản" icon="shield" />
          <span className="strong">{user?.email ?? 'Chưa đăng nhập'}</span>
          <span className="sync-bar">
            <Icon name="cloud" size={16} />
            {syncing ? 'Đang đồng bộ…' : pendingCount > 0 ? `${pendingCount} thay đổi đang chờ gửi lên máy chủ` : 'Mọi thay đổi đã được lưu trên máy chủ'}
          </span>
          <div className="row wrap">
            <Button small variant="secondary" icon="refresh" label="Đồng bộ ngay" disabled={syncing} onClick={sync} />
            <Button small variant="secondary" label="Đổi mật khẩu" onClick={() => setPasswordOpen(true)} />
            <Button small variant="secondary" icon="logout" label="Đăng xuất" onClick={() => setSignOutOpen(true)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Giao diện" icon="sun" />
          <Segmented<ThemeMode>
            options={[
              { id: 'system', label: 'Theo máy' },
              { id: 'light', label: 'Sáng' },
              { id: 'dark', label: 'Tối' },
            ]}
            value={prefs.themeMode}
            onChange={(themeMode) => setPrefs({ themeMode })}
          />
          <Toggle title="Ẩn số dư" hint="Thay số tiền bằng dấu chấm khi dùng app ở nơi công cộng" checked={prefs.hideBalance} onChange={(hideBalance) => setPrefs({ hideBalance })} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Quản lý" icon="settings" />
        <div className="list">
          {MANAGE.map((m) => (
            <Link className="item" to={m.to} key={m.to}>
              <Icon name={m.icon} />
              <span className="grow title">{m.label}</span>
              <Icon name="next" size={16} />
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid-2">
        <DataCards />
      </div>

      <span className="caption">Khoá app bằng sinh trắc học và thông báo nhắc chỉ có trên app điện thoại.</span>

      <Card>
        <CardHeader title="Vùng nguy hiểm" />
        <span className="label">Xoá tài khoản sẽ xoá toàn bộ dữ liệu trên máy chủ, kể cả dữ liệu đang dùng trên app điện thoại.</span>
        <div>
          <Button
            variant="danger"
            icon="trash"
            label="Xoá tài khoản và toàn bộ dữ liệu"
            onClick={() => {
              setDeleteText('');
              setDeleteError('');
              setDeleteOpen(true);
            }}
          />
        </div>
      </Card>

      {passwordOpen ? (
        <Modal title="Đổi mật khẩu" onClose={() => setPasswordOpen(false)} onSave={changePassword} saveLabel="Đổi mật khẩu" error={passwordError}>
          <Field label="Mật khẩu mới" hint="Ít nhất 6 ký tự.">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
          </Field>
        </Modal>
      ) : null}
      {signOutOpen ? (
        <Modal title="Đăng xuất?" onClose={() => setSignOutOpen(false)} onSave={() => signOut()} saveLabel="Đăng xuất">
          <span className="label">
            {pendingCount > 0
              ? `Còn ${pendingCount} thay đổi chưa gửi lên máy chủ. Hãy bấm "Đồng bộ ngay" trước khi đăng xuất để không mất dữ liệu.`
              : 'Dữ liệu của bạn đã được lưu trên máy chủ và sẽ có lại khi đăng nhập.'}
          </span>
        </Modal>
      ) : null}
      {deleteOpen ? (
        <Modal title="Xoá tài khoản" onClose={() => setDeleteOpen(false)} onSave={removeAccount} saveLabel="Xoá vĩnh viễn" error={deleteError}>
          <Banner tone="danger">
            Toàn bộ tài sản, giao dịch, mục tiêu và tài khoản đăng nhập sẽ bị xoá vĩnh viễn trên mọi thiết bị, không thể khôi phục. Hãy xuất CSV trước nếu bạn muốn giữ lại dữ liệu.
          </Banner>
          <Field label='Gõ "XOA" để xác nhận'>
            <input className="input" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
