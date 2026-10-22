import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './src/components/Icon';
import { AdvisorScreen } from './src/screens/AdvisorScreen';
import { AssetsScreen } from './src/screens/AssetsScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { StoreProvider, useStore } from './src/store';
import { colors, ui } from './src/theme';

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: 'overview', Screen: OverviewScreen },
  { id: 'assets', label: 'Tài sản', icon: 'assets', Screen: AssetsScreen },
  { id: 'transactions', label: 'Thu chi', icon: 'transactions', Screen: TransactionsScreen },
  { id: 'goals', label: 'Mục tiêu', icon: 'goals', Screen: GoalsScreen },
  { id: 'advisor', label: 'Cố vấn AI', icon: 'advisor', Screen: AdvisorScreen },
] as const;

function Main() {
  const { loaded, user, signOut, syncError, dismissSyncError } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('overview');
  const current = TABS.find((t) => t.id === tab)!;

  const handleSignOut = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất tài khoản?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: signOut },
    ]);
  };

  // If user is not authenticated, show login/signup screen
  if (!user) {
    return (
      <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
        <AuthScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      {/* Header with current tab icon, title, and logout action */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={current.icon} size={20} color={colors.primary} />
          <Text style={ui.title}>{current.label}</Text>
        </View>
        <Pressable
          onPress={handleSignOut}
          hitSlop={8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <Icon name="logout" size={13} color={colors.muted} />
          <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '500' }}>
            Đăng xuất
          </Text>
        </Pressable>
      </View>

      {syncError ? (
        <Pressable
          onPress={dismissSyncError}
          style={{
            marginHorizontal: 12,
            marginTop: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: '#FECACA',
            backgroundColor: '#FEF2F2',
          }}
          accessibilityRole="alert"
        >
          <Text style={{ fontSize: 12, color: colors.expense }}>
            {syncError} <Text style={{ color: colors.muted }}>(chạm để ẩn)</Text>
          </Text>
        </Pressable>
      ) : null}

      {/* Screen Body */}
      <View style={{ flex: 1 }}>
        {loaded ? (
          <current.Screen />
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        )}
      </View>

      {/* Bottom navigation bar with icons and labels */}
      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                paddingVertical: 4,
                borderRadius: 6,
                marginHorizontal: 4,
                backgroundColor: active ? colors.primaryLight : 'transparent',
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Icon
                name={t.icon}
                size={20}
                color={active ? colors.primary : colors.muted}
                strokeWidth={active ? 2.3 : 1.8}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: active ? '700' : '500',
                  color: active ? colors.primary : colors.muted,
                  letterSpacing: -0.1,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Main />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
