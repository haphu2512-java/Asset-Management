import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AdvisorScreen } from './src/screens/AdvisorScreen';
import { AssetsScreen } from './src/screens/AssetsScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { GoalsScreen } from './src/screens/GoalsScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { StoreProvider, useStore } from './src/store';
import { colors, ui } from './src/theme';

const TABS = [
  { id: 'overview', label: 'Tổng quan', Screen: OverviewScreen },
  { id: 'assets', label: 'Tài sản', Screen: AssetsScreen },
  { id: 'transactions', label: 'Thu chi', Screen: TransactionsScreen },
  { id: 'goals', label: 'Mục tiêu', Screen: GoalsScreen },
  { id: 'advisor', label: 'Cố vấn AI', Screen: AdvisorScreen },
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
      {/* Human-designed clean professional header with subtle border */}
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
        <Text style={ui.title}>{current.label}</Text>
        <Pressable
          onPress={handleSignOut}
          hitSlop={8}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
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

      {/* Human-designed Segmented/Tab bar with precise active border */}
      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          height: 52,
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
                borderTopWidth: active ? 2 : 0,
                borderTopColor: active ? colors.primary : 'transparent',
                backgroundColor: active ? colors.primaryLight : 'transparent',
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: active ? '600' : '500',
                  color: active ? colors.primary : colors.muted,
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
