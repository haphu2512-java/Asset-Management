import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { usePrefs } from '@shared/prefs';
import { useStore } from '@shared/store';
import { ComposerProvider, useComposer } from './components/Composer';
import { Icon } from './components/Icon';
import { Banner, Button, IconButton } from './components/ui';
import { useAppliedTheme } from './hooks';
import { AdvisorPage } from './pages/Advisor';
import { AssetDetailPage } from './pages/AssetDetail';
import { AssetsPage } from './pages/Assets';
import { AuthPage } from './pages/Auth';
import { BudgetsPage } from './pages/Budgets';
import { CategoriesPage } from './pages/Categories';
import { GoalsPage } from './pages/Goals';
import { OverviewPage } from './pages/Overview';
import { RecurringPage } from './pages/Recurring';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { TransactionsPage } from './pages/Transactions';
import { isConfigured } from './supabase';

const PRIMARY = [
  { to: '/', label: 'Tổng quan', icon: 'home' },
  { to: '/assets', label: 'Tài sản', icon: 'wallet' },
  { to: '/transactions', label: 'Thu chi', icon: 'transactions' },
  { to: '/goals', label: 'Mục tiêu', icon: 'goals' },
];
const SECONDARY = [
  { to: '/budgets', label: 'Ngân sách', icon: 'budget' },
  { to: '/recurring', label: 'Định kỳ', icon: 'clock' },
  { to: '/reports', label: 'Báo cáo', icon: 'chart' },
  { to: '/categories', label: 'Danh mục', icon: 'tag' },
  { to: '/advisor', label: 'Cố vấn AI', icon: 'sparkle' },
];
const TITLES: Record<string, string> = {
  '/': 'Tổng quan',
  '/assets': 'Tài sản',
  '/transactions': 'Thu chi',
  '/goals': 'Mục tiêu',
  '/budgets': 'Ngân sách',
  '/recurring': 'Giao dịch định kỳ',
  '/reports': 'Báo cáo',
  '/categories': 'Danh mục thu chi',
  '/advisor': 'Cố vấn AI',
  '/settings': 'Cài đặt',
};

function Shell() {
  const { prefs, setPrefs } = usePrefs();
  const store = useStore();
  const composer = useComposer();
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? (pathname.startsWith('/assets/') ? 'Chi tiết tài sản' : 'Quản lý tài sản');
  const link = (item: { to: string; label: string; icon: string }) => (
    <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icon.png" alt="" />
          Quản lý tài sản
        </div>
        {PRIMARY.map(link)}
        <div className="nav-section">Quản lý</div>
        {SECONDARY.map(link)}
        <span className="spacer" />
        {link({ to: '/settings', label: 'Cài đặt', icon: 'settings' })}
      </aside>
      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          {store.pendingCount > 0 ? (
            <span className="pill warn" title="Thay đổi đang chờ gửi lên máy chủ">
              <Icon name="cloud" size={14} /> {store.pendingCount} chờ đồng bộ
            </span>
          ) : null}
          <IconButton icon={prefs.hideBalance ? 'eye-off' : 'eye'} label={prefs.hideBalance ? 'Hiện số dư' : 'Ẩn số dư'} onClick={() => setPrefs({ hideBalance: !prefs.hideBalance })} />
          <NavLink to="/settings" className="icon-btn" aria-label="Cài đặt" title="Cài đặt">
            <Icon name="settings" />
          </NavLink>
        </header>
        <main className="content">
          {store.syncError ? (
            <Banner tone="warning">
              <span className="grow">{store.syncError}</span>
              <button className="link" onClick={store.dismissSyncError}>
                Đóng
              </button>
            </Banner>
          ) : null}
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/advisor" element={<AdvisorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <button className="fab" aria-label="Thêm giao dịch" title="Thêm giao dịch" onClick={() => composer.open()}>
        <Icon name="plus" size={26} />
      </button>
      <nav className="bottom-nav" aria-label="Điều hướng chính">
        {PRIMARY.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={item.icon} size={22} />
            {item.label}
          </NavLink>
        ))}
        <NavLink to="/settings" className={({ isActive }) => (isActive || SECONDARY.some((s) => s.to === pathname) ? 'active' : '')}>
          <Icon name="menu" size={22} />
          Thêm
        </NavLink>
      </nav>
    </div>
  );
}

function MissingConfig() {
  return (
    <div className="auth">
      <div className="auth-box card">
        <h2>Chưa cấu hình Supabase</h2>
        <p className="label" style={{ margin: 0 }}>
          Bản web dùng chung dữ liệu với app điện thoại. Hãy khai báo hai biến môi trường sau trong Vercel (Project → Settings → Environment
          Variables) rồi deploy lại:
        </p>
        <span className="kbd">EXPO_PUBLIC_SUPABASE_URL</span>
        <span className="kbd">EXPO_PUBLIC_SUPABASE_ANON_KEY</span>
        <p className="label" style={{ margin: 0 }}>Khi chạy trên máy, tạo file web/.env từ web/.env.example.</p>
      </div>
    </div>
  );
}

export function App() {
  useAppliedTheme();
  const store = useStore();
  if (!isConfigured) return <MissingConfig />;
  if (!store.authReady) {
    return (
      <div className="center-screen">
        <div className="spinner" role="status" aria-label="Đang tải" />
      </div>
    );
  }
  if (!store.user) return <AuthPage />;
  if (!store.loaded) {
    return (
      <div className="center-screen">
        <div className="stack" style={{ alignItems: 'center' }}>
          <div className="spinner" role="status" aria-label="Đang tải dữ liệu" />
          <span className="label">Đang tải dữ liệu…</span>
          {store.syncError ? <Button variant="secondary" label="Thử lại" onClick={() => store.syncNow()} /> : null}
        </div>
      </div>
    );
  }
  return (
    <ComposerProvider>
      <Shell />
    </ComposerProvider>
  );
}
