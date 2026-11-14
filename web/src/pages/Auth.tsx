import { useState } from 'react';
import { Banner, Button } from '../components/ui';
import { supabase } from '../supabase';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

const TITLES: Record<Mode, { title: string; subtitle: string; action: string }> = {
  signin: { title: 'Đăng nhập', subtitle: 'Quản lý tài sản, thu chi và mục tiêu ở một nơi.', action: 'Đăng nhập' },
  signup: { title: 'Tạo tài khoản', subtitle: 'Miễn phí. Dữ liệu được đồng bộ giữa các thiết bị của bạn.', action: 'Đăng ký' },
  forgot: { title: 'Quên mật khẩu', subtitle: 'Nhập email, app sẽ gửi cho bạn một mã xác nhận.', action: 'Gửi mã' },
  reset: { title: 'Đặt mật khẩu mới', subtitle: 'Nhập mã trong email và mật khẩu mới.', action: 'Đổi mật khẩu' },
};

/** Turns Supabase auth errors into messages a user can act on. */
function describe(error: { message?: string; status?: number; code?: string }): string {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (text.includes('invalid login credentials') || text.includes('invalid_credentials')) return 'Email hoặc mật khẩu không đúng.';
  if (text.includes('email not confirmed')) return 'Email chưa được xác nhận. Hãy bấm liên kết trong thư kích hoạt.';
  if (text.includes('already registered') || text.includes('user_already_exists')) return 'Email này đã có tài khoản. Hãy đăng nhập.';
  if (text.includes('rate limit') || error.status === 429) return 'Bạn thao tác quá nhanh. Hãy thử lại sau ít phút.';
  if (text.includes('expired') || text.includes('otp') || text.includes('token')) return 'Mã không đúng hoặc đã hết hạn. Hãy gửi lại mã.';
  if (text.includes('network') || text.includes('fetch')) return 'Không có kết nối mạng. Hãy thử lại.';
  if (text.includes('password')) return 'Mật khẩu chưa đạt yêu cầu (ít nhất 6 ký tự).';
  return 'Không thực hiện được yêu cầu. Hãy thử lại.';
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const go = (next: Mode, message = '') => {
    setMode(next);
    setError('');
    setInfo(message);
    setPassword('');
    setCode('');
  };

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    setError('');
    setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError('Hãy nhập một địa chỉ email hợp lệ.');
    if (mode !== 'forgot' && password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.');
    if (mode === 'reset' && code.trim().length < 6) return setError('Hãy nhập mã xác nhận trong email.');
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (e) throw e;
      } else if (mode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({ email: cleanEmail, password, options: { emailRedirectTo: window.location.origin } });
        if (e) throw e;
        // An address that already has an account comes back without identities instead of an error.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          return go('signin', 'Email này đã có tài khoản. Hãy đăng nhập.');
        }
        if (!data.session) go('signin', 'Đăng ký thành công. Hãy mở thư kích hoạt trong hộp thư rồi đăng nhập.');
      } else if (mode === 'forgot') {
        const { error: e } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (e) throw e;
        go('reset', `Nếu ${cleanEmail} có tài khoản, một mã xác nhận đã được gửi tới hộp thư. Hãy kiểm tra cả mục thư rác.`);
      } else {
        const { error: e } = await supabase.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: 'recovery' });
        if (e) throw e;
        // The code signs the user in; set the new password straight away.
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
      }
    } catch (e) {
      setError(describe(e as { message?: string; status?: number; code?: string }));
    } finally {
      setLoading(false);
    }
  };

  const t = TITLES[mode];
  return (
    <div className="auth">
      <div className="auth-box">
        <div className="auth-logo">
          <img src="/icon.png" alt="" />
          <h1 style={{ fontSize: 24 }}>{t.title}</h1>
          <span className="label">{t.subtitle}</span>
        </div>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {info ? <Banner tone="success">{info}</Banner> : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <label className="field">
            <span className="label">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@example.com" autoComplete="email" disabled={mode === 'reset'} autoFocus />
          </label>
          {mode === 'reset' ? (
            <label className="field">
              <span className="label">Mã xác nhận</span>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã trong email" inputMode="numeric" autoComplete="one-time-code" />
            </label>
          ) : null}
          {mode !== 'forgot' ? (
            <label className="field">
              <span className="label">{mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}</span>
              <div className="row">
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
                <button type="button" className="link" onClick={() => setShowPassword((s) => !s)} style={{ whiteSpace: 'nowrap' }}>
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </label>
          ) : null}
          <Button type="submit" block label={loading ? 'Đang xử lý…' : t.action} disabled={loading} />
          {mode === 'signin' ? (
            <button type="button" className="link" onClick={() => go('forgot')}>
              Quên mật khẩu?
            </button>
          ) : null}
          {mode === 'reset' ? (
            <button type="button" className="link" onClick={() => go('forgot')}>
              Gửi lại mã
            </button>
          ) : null}
        </form>
        <div className="row" style={{ justifyContent: 'center' }}>
          <span className="label">{mode === 'signin' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}</span>
          <button type="button" className="link" onClick={() => go(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  );
}
