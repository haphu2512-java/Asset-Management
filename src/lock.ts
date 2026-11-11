import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** Whether the device has a fingerprint, face or screen lock the app can ask for. */
export async function deviceCanLock(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Shows the system unlock prompt. Resolves true when the user proved who they are. */
export async function unlock(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Mở khoá Asset Management',
      cancelLabel: 'Huỷ',
    });
    return result.success;
  } catch {
    return false;
  }
}
