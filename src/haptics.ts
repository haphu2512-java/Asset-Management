import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Short vibration to confirm an action. Does nothing where the device has no haptics. */
export function haptic(kind: 'light' | 'success' | 'warning' = 'light'): void {
  if (Platform.OS === 'web') return;
  const run =
    kind === 'light'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(
          kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
        );
  run.catch(() => {});
}
