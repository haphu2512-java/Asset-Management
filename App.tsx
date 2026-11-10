import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ComposerProvider, useComposer } from './src/components/Composer';
import { Icon, type IconName } from './src/components/Icon';
import { Onboarding } from './src/components/Onboarding';
import { ToastProvider } from './src/components/Toast';
import { Banner, Button, IconButton } from './src/components/ui';
import { getTransactionCategory, todayKey } from './src/finance';
import { haptic } from './src/haptics';
import { unlock } from './src/lock';
import { NavProvider, useNav, type Route, type TabId } from './src/nav';
import { syncScheduledReminders } from './src/notifications';
import { PrefsProvider, usePrefs } from './src/prefs';
import { planReminders } from './src/reminders';
import { AdvisorScreen } from './src/screens/AdvisorScreen';
import { AssetDetailScreen } from './src/screens/AssetDetailScreen';
import { AssetsScreen } from './src/screens/AssetsScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { BudgetsScreen } from './src/screens/BudgetsScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { CategoryDetailScreen } from './src/screens/CategoryDetailScreen';
import { DataScreen } from './src/screens/DataScreen';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { RecurringScreen } from './src/screens/RecurringScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { StoreProvider, useStore } from './src/store';
import { font, space, ThemeProvider, TOUCH, useTheme } from './src/theme';

const TABS: { id: TabId; label: string; icon: IconName; Screen: () => ReactNode }[] = [
  { id: 'overview', label: 'Tổng quan', icon: 'overview', Screen: OverviewScreen },
  { id: 'assets', label: 'Tài sản', icon: 'assets', Screen: AssetsScreen },
  { id: 'transactions', label: 'Thu chi', icon: 'transactions', Screen: TransactionsScreen },
  { id: 'goals', label: 'Mục tiêu', icon: 'goals', Screen: GoalsScreen },
];

/** Seconds the app may stay in the background before it locks again. */
const RELOCK_AFTER_MS = 30_000;

function RouteScreen({ route }: { route: Route }) {
  switch (route.name) {
    case 'settings':
      return <SettingsScreen />;
    case 'asset':
      return <AssetDetailScreen id={route.id} />;
    case 'category':
      return <CategoryDetailScreen id={route.id} month={route.month} />;
    case 'budgets':
      return <BudgetsScreen />;
    case 'recurring':
      return <RecurringScreen />;
    case 'categories':
      return <CategoriesScreen />;
    case 'reports':
      return <ReportsScreen />;
    case 'search':
      return <SearchScreen accountId={route.accountId} />;
    case 'advisor':
      return <AdvisorScreen question={route.question} />;
    case 'data':
      return <DataScreen />;
  }
}

function useRouteTitle(route: Route | undefined): string {
  const { assets, categories } = useStore();
  if (!route) return '';
  switch (route.name) {
    case 'settings':
      return 'Cài đặt';
    case 'asset': {
      const asset = assets.find((a) => a.id === route.id);
      return asset ? asset.name : 'Tài sản';
    }
    case 'category':
      return getTransactionCategory(route.id, categories).label;
    case 'budgets':
      return 'Ngân sách';
    case 'recurring':
      return 'Giao dịch định kỳ';
    case 'categories':
      return 'Danh mục thu chi';
    case 'reports':
      return 'Báo cáo';
    case 'search':
      return 'Tìm giao dịch';
    case 'advisor':
      return 'Cố vấn AI';
    case 'data':
      return 'Xuất, nhập dữ liệu';
  }
}

/** Keeps the phone's scheduled reminders in step with the settings and the data. */
function useReminders() {
  const { assets, goals, recurring, loaded } = useStore();
  const { prefs, ready } = usePrefs();
  useEffect(() => {
    if (!ready || !loaded) return;
    const timer = setTimeout(() => {
      void syncScheduledReminders({
        daily: prefs.reminder,
        events: prefs.eventReminders ? planReminders({ assets, goals, recurring }, todayKey()) : [],
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [ready, loaded, prefs.reminder, prefs.eventReminders, assets, goals, recurring]);
}

function Shell() {
  const { colors, ui } = useTheme();
  const { loaded, syncError, dismissSyncError, pendingCount } = useStore();
  const { prefs, setPrefs } = usePrefs();
  const nav = useNav();
  const composer = useComposer();
  useReminders();

  const route = nav.stack[nav.stack.length - 1];
  const routeTitle = useRouteTitle(route);
  const current = TABS.find((t) => t.id === nav.tab) ?? TABS[0];
  const title = route ? routeTitle : current.label;

  const tabButton = (t: (typeof TABS)[number]) => {
    const active = !route && t.id === nav.tab;
    return (
      <Pressable
        key={t.id}
        onPress={() => nav.setTab(t.id)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: TOUCH + 6 }}
        accessibilityRole="tab"
        accessibilityLabel={t.label}
        accessibilityState={{ selected: active }}
      >
        <Icon name={t.icon} size={22} color={active ? colors.primary : colors.muted} strokeWidth={active ? 2.3 : 1.8} />
        <Text style={{ fontSize: font.caption, fontWeight: active ? '700' : '500', color: active ? colors.primary : colors.muted }}>
          {t.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <View
        style={{
          paddingHorizontal: space.sm,
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {route ? (
          <IconButton icon="chevron-left" label="Quay lại" onPress={nav.pop} color={colors.text} />
        ) : (
          <View style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={current.icon} size={22} color={colors.primary} />
          </View>
        )}
        <Text style={[ui.title, { flex: 1 }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <IconButton
          icon={prefs.hideBalance ? 'eye-off' : 'eye'}
          label={prefs.hideBalance ? 'Hiện số dư' : 'Ẩn số dư'}
          onPress={() => setPrefs({ hideBalance: !prefs.hideBalance })}
        />
        {!route ? (
          <>
            <IconButton icon="search" label="Tìm giao dịch" onPress={() => nav.push({ name: 'search' })} />
            <IconButton icon="settings" label="Cài đặt" onPress={() => nav.push({ name: 'settings' })} />
          </>
        ) : null}
      </View>

      {syncError ? (
        <View style={{ paddingHorizontal: space.md, paddingTop: space.sm }}>
          <Banner tone="danger" onPress={dismissSyncError}>
            {syncError} (chạm để ẩn)
          </Banner>
        </View>
      ) : pendingCount > 0 && !route ? (
        <View style={{ paddingHorizontal: space.md, paddingTop: space.sm }}>
          <Banner tone="info" icon="refresh">
            {`${pendingCount} thay đổi đã lưu trên máy, sẽ tự đồng bộ khi có mạng.`}
          </Banner>
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        {!loaded ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} accessibilityLabel="Đang tải dữ liệu" />
        ) : route ? (
          <RouteScreen key={nav.stack.length + JSON.stringify(route)} route={route} />
        ) : (
          <current.Screen />
        )}
      </View>

      {!route ? (
        <View
          accessibilityRole="tablist"
          style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card, paddingVertical: 4 }}
        >
          {TABS.slice(0, 2).map(tabButton)}
          <View style={{ width: 72, alignItems: 'center' }}>
            <Pressable
              onPress={() => {
                haptic('light');
                composer.open();
              }}
              accessibilityRole="button"
              accessibilityLabel="Thêm giao dịch"
              style={({ pressed }) => ({
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
                marginTop: -18,
                borderWidth: 3,
                borderColor: colors.card,
              })}
            >
              <Icon name="plus" size={26} color={colors.onPrimary} strokeWidth={2.4} />
            </Pressable>
          </View>
          {TABS.slice(2).map(tabButton)}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** Asks for fingerprint / face / device PIN when the app opens or returns from the background. */
function LockGate({ children }: { children: ReactNode }) {
  const { colors, ui } = useTheme();
  const { prefs } = usePrefs();
  const { signOut } = useStore();
  const enabled = prefs.appLock && Platform.OS !== 'web';
  const [locked, setLocked] = useState(enabled);
  const leftAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const tryUnlock = async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await unlock();
    prompting.current = false;
    if (ok) setLocked(false);
  };

  useEffect(() => {
    if (!enabled) return setLocked(false);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now();
      // The system unlock prompt itself briefly makes the app inactive; only a real absence locks.
      if (state === 'active' && leftAt.current && Date.now() - leftAt.current > RELOCK_AFTER_MS) setLocked(true);
      if (state === 'active') leftAt.current = null;
    });
    return () => sub.remove();
  }, [enabled]);

  useEffect(() => {
    if (enabled && locked) void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, locked]);

  if (!enabled || !locked) return <>{children}</>;
  return (
    <SafeAreaView style={[ui.screen, { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl }]}>
      <Icon name="lock" size={48} color={colors.primary} />
      <Text style={ui.title} accessibilityRole="header">
        App đang khoá
      </Text>
      <Text style={[ui.label, { textAlign: 'center' }]}>Xác thực bằng vân tay, khuôn mặt hoặc mã khoá máy để xem dữ liệu tài chính.</Text>
      <Button label="Mở khoá" icon="lock" onPress={tryUnlock} />
      <Button variant="ghost" small label="Đăng xuất" onPress={() => void signOut()} />
    </SafeAreaView>
  );
}

function Root() {
  const { colors, ui, dark } = useTheme();
  const { authReady, user, loaded, assets, transactions, goals } = useStore();
  const { prefs, ready, setPrefs } = usePrefs();

  let body: ReactNode;
  if (!authReady || !ready) {
    body = (
      <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Đang mở app" />
      </View>
    );
  } else if (!user) {
    body = (
      <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
        <AuthScreen />
      </SafeAreaView>
    );
  } else {
    const isNew = loaded && assets.length === 0 && transactions.length === 0 && goals.length === 0;
    const finish = () => setPrefs({ onboarded: { ...prefs.onboarded, [user.id]: true } });
    body = (
      <LockGate>
        {/* Keyed by user so one person's open screens never show under another account. */}
        <NavProvider key={user.id}>
          <ToastProvider>
            <ComposerProvider>
              {!prefs.onboarded[user.id] && isNew ? (
                <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
                  <Onboarding onDone={finish} />
                </SafeAreaView>
              ) : (
                <Shell />
              )}
            </ComposerProvider>
          </ToastProvider>
        </NavProvider>
      </LockGate>
    );
  }

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {body}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <ThemeProvider>
          <StoreProvider>
            <Root />
          </StoreProvider>
        </ThemeProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
