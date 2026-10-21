import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AdvisorScreen } from './src/screens/AdvisorScreen';
import { AssetsScreen } from './src/screens/AssetsScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { StoreProvider, useStore } from './src/store';
import { colors, ui } from './src/theme';

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: '◉', Screen: OverviewScreen },
  { id: 'assets', label: 'Tài sản', icon: '◈', Screen: AssetsScreen },
  { id: 'transactions', label: 'Thu chi', icon: '⇅', Screen: TransactionsScreen },
  { id: 'advisor', label: 'AI', icon: '✦', Screen: AdvisorScreen },
] as const;

function Main() {
  const { loaded, user, signOut } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('overview');
  const current = TABS.find((t) => t.id === tab)!;

  const handleSignOut = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
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
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 4,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={ui.title}>{current.label}</Text>
        <Pressable
          onPress={handleSignOut}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: '#FFEBEE',
          }}
        >
          <Text style={{ fontSize: 12, color: colors.expense, fontWeight: '600' }}>
            Đăng xuất
          </Text>
        </Pressable>
      </View>

      {/* Screen Body */}
      <View style={{ flex: 1 }}>
        {loaded ? (
          <current.Screen />
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        )}
      </View>

      {/* Bottom Tabs */}
      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={{
                  fontSize: 18,
                  color: active ? colors.primary : colors.muted,
                }}
              >
                {t.icon}
              </Text>
              <Text
                style={{
                  fontSize: 12,
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
