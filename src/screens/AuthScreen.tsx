import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Banner, Button, IconButton, Input, LinkText } from '../components/ui';
import { supabase } from '../supabase';
import { font, radius, space, useTheme } from '../theme';

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

export function AuthScreen() {
  const { colors, ui } = useTheme();
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
        const { data, error: e } = await supabase.auth.signUp({ email: cleanEmail, password });
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ui.screen}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.lg,
              backgroundColor: colors.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="wallet" size={32} color={colors.primary} />
          </View>
          <Text style={{ fontSize: font.headline, fontWeight: '800', color: colors.text }} accessibilityRole="header">
            {t.title}
          </Text>
          <Text style={[ui.label, { textAlign: 'center', fontSize: font.body }]}>{t.subtitle}</Text>
        </View>

        <View style={[ui.card, { gap: space.md }]}>
          {info ? <Banner tone="success">{info}</Banner> : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}

          <View style={{ gap: 6 }}>
            <Text style={ui.label}>Email</Text>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="ban@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={mode !== 'reset'}
              accessibilityLabel="Email"
            />
          </View>

          {mode === 'reset' ? (
            <View style={{ gap: 6 }}>
              <Text style={ui.label}>Mã xác nhận trong email</Text>
              <Input
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 10))}
                placeholder="Ví dụ: 123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                accessibilityLabel="Mã xác nhận"
              />
            </View>
          ) : null}

          {mode !== 'forgot' ? (
            <View style={{ gap: 6 }}>
              <Text style={ui.label}>{mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Ít nhất 6 ký tự"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                    onSubmitEditing={submit}
                    returnKeyType="go"
                    accessibilityLabel={mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
                  />
                </View>
                <IconButton
                  icon={showPassword ? 'eye-off' : 'eye'}
                  label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onPress={() => setShowPassword((v) => !v)}
                />
              </View>
            </View>
          ) : null}

          <Button label={t.action} onPress={submit} loading={loading} />

          {mode === 'signin' ? (
            <View style={{ alignItems: 'center' }}>
              <LinkText label="Quên mật khẩu?" onPress={() => go('forgot')} />
            </View>
          ) : null}
          {mode === 'reset' ? (
            <View style={{ alignItems: 'center' }}>
              <LinkText label="Gửi lại mã" onPress={() => go('forgot')} />
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={ui.label}>{mode === 'signin' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}</Text>
          <LinkText label={mode === 'signin' ? 'Đăng ký' : 'Đăng nhập'} onPress={() => go(mode === 'signin' ? 'signup' : 'signin')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
