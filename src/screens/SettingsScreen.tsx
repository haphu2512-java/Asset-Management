import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { confirm } from '../confirm';
import { Field, Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { Banner, Card, CardHeader, Input, NavRow, Segmented, ToggleRow } from '../components/ui';
import { deviceCanLock } from '../lock';
import { useNav } from '../nav';
import { ensureNotificationPermission, notificationsSupported } from '../notifications';
import { usePrefs, type ThemeMode } from '../prefs';
import { useStore } from '../store';
import { supabase } from '../supabase';
import { useTheme } from '../theme';

const HOURS = [7, 12, 18, 20, 21, 22];

export function SettingsScreen() {
  const { ui } = useTheme();
  const { user, pendingCount, syncNow, signOut, deleteAccount, budgets, recurring, customCategories } = useStore();
  const { prefs, setPrefs } = usePrefs();
  const nav = useNav();
  const toast = useToast();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const changePassword = async () => {
    if (password.length < 6) return setPasswordError('Mật khẩu cần ít nhất 6 ký tự.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setPasswordError('Không đổi được mật khẩu. Hãy kiểm tra kết nối và thử lại.');
    setPasswordOpen(false);
    setPassword('');
    toast.show({ message: 'Đã đổi mật khẩu.', tone: 'success' });
  };

  const logout = () =>
    confirm({
      title: 'Đăng xuất?',
      message:
        pendingCount > 0
          ? `Còn ${pendingCount} thay đổi chưa đồng bộ lên máy chủ. App sẽ thử đồng bộ trước, nếu không có mạng các thay đổi này sẽ mất.`
          : 'Dữ liệu của bạn đã được lưu trên máy chủ và sẽ có lại khi đăng nhập.',
      confirmLabel: 'Đăng xuất',
      destructive: true,
      onConfirm: () => void signOut(),
    });

  const removeAccount = async () => {
    if (deleteText.trim().toUpperCase() !== 'XOA') return setDeleteError('Hãy gõ XOA để xác nhận.');
    const error = await deleteAccount();
    if (error) return setDeleteError(error);
    setDeleteOpen(false);
  };

  const toggleLock = async (on: boolean) => {
    if (on && !(await deviceCanLock())) {
      return toast.show({ message: 'Thiết bị chưa cài vân tay, khuôn mặt hoặc mã khoá màn hình.', tone: 'warning' });
    }
    setPrefs({ appLock: on });
  };

  const toggleDaily = async (on: boolean) => {
    if (on && !(await ensureNotificationPermission())) {
      return toast.show({ message: 'App chưa được cấp quyền gửi thông báo. Hãy bật trong cài đặt của máy.', tone: 'warning' });
    }
    setPrefs({ reminder: { ...prefs.reminder, enabled: on } });
  };
  const toggleEvents = async (on: boolean) => {
    if (on && !(await ensureNotificationPermission())) {
      return toast.show({ message: 'App chưa được cấp quyền gửi thông báo. Hãy bật trong cài đặt của máy.', tone: 'warning' });
    }
    setPrefs({ eventReminders: on });
  };

  const sync = async () => {
    setSyncing(true);
    await syncNow();
    setSyncing(false);
    toast.show({ message: 'Đã đồng bộ xong.', tone: 'success' });
  };

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <Card>
          <CardHeader title="Tài khoản" icon="user" />
          <Text style={ui.text}>{user?.email ?? 'Chưa đăng nhập'}</Text>
          <NavRow
            icon="refresh"
            title={syncing ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
            subtitle={pendingCount > 0 ? `${pendingCount} thay đổi đang chờ gửi lên máy chủ` : 'Mọi thay đổi đã được lưu trên máy chủ'}
            onPress={sync}
          />
          <NavRow icon="lock" title="Đổi mật khẩu" onPress={() => { setPassword(''); setPasswordError(''); setPasswordOpen(true); }} />
          <NavRow icon="logout" title="Đăng xuất" onPress={logout} />
        </Card>

        <Card>
          <CardHeader title="Quản lý" icon="settings" />
          <NavRow icon="budget" title="Ngân sách" value={budgets.length ? `${budgets.length}` : undefined} onPress={() => nav.push({ name: 'budgets' })} />
          <NavRow icon="refresh" title="Giao dịch định kỳ" value={recurring.length ? `${recurring.length}` : undefined} onPress={() => nav.push({ name: 'recurring' })} />
          <NavRow icon="tag" title="Danh mục thu chi" value={customCategories.length ? `${customCategories.length} tuỳ chỉnh` : undefined} onPress={() => nav.push({ name: 'categories' })} />
          <NavRow icon="sparkles" title="Cố vấn AI" onPress={() => nav.push({ name: 'advisor' })} />
          <NavRow icon="chart" title="Báo cáo" onPress={() => nav.push({ name: 'reports' })} />
          <NavRow icon="download" title="Xuất, nhập dữ liệu CSV" onPress={() => nav.push({ name: 'data' })} />
        </Card>

        <Card>
          <CardHeader title="Giao diện" icon="moon" />
          <Segmented<ThemeMode>
            options={[
              { id: 'system', label: 'Theo máy' },
              { id: 'light', label: 'Sáng' },
              { id: 'dark', label: 'Tối' },
            ]}
            value={prefs.themeMode}
            onChange={(themeMode) => setPrefs({ themeMode })}
          />
          <ToggleRow
            icon="eye-off"
            title="Ẩn số dư"
            subtitle="Thay số tiền bằng dấu chấm khi dùng app ở nơi công cộng"
            value={prefs.hideBalance}
            onChange={(hideBalance) => setPrefs({ hideBalance })}
          />
        </Card>

        <Card>
          <CardHeader title="Bảo mật" icon="shield" />
          <ToggleRow
            icon="lock"
            title="Khoá app"
            subtitle="Yêu cầu vân tay, khuôn mặt hoặc mã khoá máy mỗi khi mở app"
            value={prefs.appLock}
            onChange={toggleLock}
          />
        </Card>

        <Card>
          <CardHeader title="Nhắc nhở" icon="bell" />
          {notificationsSupported() ? (
            <>
              <ToggleRow
                icon="clock"
                title="Nhắc ghi chi tiêu mỗi ngày"
                subtitle={`Lúc ${String(prefs.reminder.hour).padStart(2, '0')}:${String(prefs.reminder.minute).padStart(2, '0')}`}
                value={prefs.reminder.enabled}
                onChange={toggleDaily}
              />
              {prefs.reminder.enabled ? (
                <Segmented
                  options={HOURS.map((h) => ({ id: String(h), label: `${h}h` }))}
                  value={String(prefs.reminder.hour)}
                  onChange={(h) => setPrefs({ reminder: { ...prefs.reminder, hour: Number(h), minute: 0 } })}
                />
              ) : null}
              <ToggleRow
                icon="calendar"
                title="Nhắc các khoản đến hạn"
                subtitle="Khoản định kỳ, nợ, sổ tiết kiệm đáo hạn và góp mục tiêu"
                value={prefs.eventReminders}
                onChange={toggleEvents}
              />
            </>
          ) : (
            <Text style={ui.label}>Thông báo nhắc chỉ có trên app điện thoại.</Text>
          )}
        </Card>

        <Card>
          <CardHeader title="Vùng nguy hiểm" icon="alert" />
          <NavRow
            icon="trash"
            title="Xoá tài khoản và toàn bộ dữ liệu"
            danger
            onPress={() => { setDeleteText(''); setDeleteError(''); setDeleteOpen(true); }}
          />
        </Card>
      </ScrollView>

      <Sheet visible={passwordOpen} title="Đổi mật khẩu" onClose={() => setPasswordOpen(false)} onSave={changePassword} saveLabel="Đổi mật khẩu" error={passwordError}>
        <Field label="Mật khẩu mới" icon="lock" hint="Ít nhất 6 ký tự.">
          <Input value={password} onChangeText={setPassword} secureTextEntry autoFocus autoCapitalize="none" accessibilityLabel="Mật khẩu mới" />
        </Field>
      </Sheet>

      <Sheet visible={deleteOpen} title="Xoá tài khoản" onClose={() => setDeleteOpen(false)} onSave={removeAccount} saveLabel="Xoá vĩnh viễn" error={deleteError}>
        <Banner tone="danger">
          Toàn bộ tài sản, giao dịch, mục tiêu và tài khoản đăng nhập sẽ bị xoá vĩnh viễn, không thể khôi phục. Hãy xuất CSV trước
          nếu bạn muốn giữ lại dữ liệu.
        </Banner>
        <Field label='Gõ "XOA" để xác nhận'>
          <Input value={deleteText} onChangeText={setDeleteText} autoCapitalize="characters" accessibilityLabel="Gõ XOA để xác nhận" />
        </Field>
      </Sheet>
    </View>
  );
}
