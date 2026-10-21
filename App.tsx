import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AdvisorScreen } from './src/screens/AdvisorScreen';
import { AssetsScreen } from './src/screens/AssetsScreen';
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
  const { loaded } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('overview');
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Text style={ui.title}>{current.label}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {loaded ? (
          <current.Screen />
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        )}
      </View>
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
              <Text style={{ fontSize: 18, color: active ? colors.primary : colors.muted }}>{t.icon}</Text>
              <Text style={{ fontSize: 12, color: active ? colors.primary : colors.muted }}>{t.label}</Text>
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
