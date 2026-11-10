import { Alert, Platform } from 'react-native';

/** Asks the user to confirm an action; works on the web too, where Alert has no buttons. */
export function confirm(options: {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  const { title, message, confirmLabel, destructive, onConfirm } = options;
  if (Platform.OS === 'web') {
    const ask = (globalThis as { confirm?: (text: string) => boolean }).confirm;
    if (!ask || ask(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Huỷ', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
