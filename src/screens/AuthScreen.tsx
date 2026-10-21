import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { supabase } from '../supabase';
import { colors, ui } from '../theme';

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    // Mắt mở
    return (
      <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <Circle cx="12" cy="12" r="3" />
      </Svg>
    );
  }
  // Mắt gạch chéo (ẩn mật khẩu)
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  );
}

export function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    if (cleanPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải có tối thiểu 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) throw error;

        // Nếu email đã tồn tại và user đã confirm, Supabase mặc định không throw error
        // (để bảo vệ chống user enumeration) mà trả về user nhưng identities rỗng []
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          Alert.alert(
            'Email đã tồn tại',
            'Email này đã được đăng ký tài khoản. Vui lòng chuyển sang Đăng nhập!',
          );
          setIsSignUp(false);
          return;
        }

        if (data.session) {
          Alert.alert('Thành công', 'Đăng ký và đăng nhập thành công!');
        } else {
          Alert.alert(
            'Đăng ký thành công',
            'Vui lòng kiểm tra hộp thư email để kích hoạt tài khoản hoặc đăng nhập lại.',
          );
          setIsSignUp(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Sai email hoặc mật khẩu, vui lòng kiểm tra lại');
          }
          throw error;
        }
      }
    } catch (err: any) {
      Alert.alert('Lỗi xác thực', err.message || 'Không thể thực hiện yêu cầu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={ui.card}>
          <Text style={[ui.title, { textAlign: 'center', marginBottom: 4 }]}>
            {isSignUp ? 'Tạo tài khoản' : 'Đăng nhập'}
          </Text>
          <Text style={[ui.label, { textAlign: 'center', marginBottom: 20 }]}>
            {isSignUp
              ? 'Đăng ký để đồng bộ dữ liệu tài chính lên Supabase'
              : 'Đăng nhập để đồng bộ tài sản và thu chi của bạn'}
          </Text>

          {/* Email input */}
          <Text style={[ui.label, { marginBottom: 6 }]}>Email</Text>
          <TextInput
            style={[ui.input, { marginBottom: 16 }]}
            placeholder="example@email.com"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password input with SVG eye toggle icon */}
          <Text style={[ui.label, { marginBottom: 6 }]}>Mật khẩu</Text>
          <View style={[styles.passwordContainer, { marginBottom: 20 }]}>
            <TextInput
              style={[styles.passwordInput, { color: colors.text }]}
              placeholder="Mật khẩu (tối thiểu 6 ký tự)"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
              hitSlop={8}
              accessibilityLabel="Hiện hoặc ẩn mật khẩu"
            >
              <EyeIcon visible={showPassword} />
            </Pressable>
          </View>

          {/* Submit button */}
          <Pressable
            style={[ui.button, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={ui.buttonText}>{isSignUp ? 'Đăng ký ngay' : 'Đăng nhập'}</Text>
            )}
          </Pressable>

          {/* Toggle login / signup */}
          <Pressable
            style={{ marginTop: 16, alignItems: 'center', paddingVertical: 8 }}
            onPress={() => {
              setIsSignUp(!isSignUp);
            }}
            disabled={loading}
          >
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '500' }}>
              {isSignUp
                ? 'Đã có tài khoản? Đăng nhập ngay'
                : 'Chưa có tài khoản? Đăng ký tại đây'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
