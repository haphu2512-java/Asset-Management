import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import { haptic } from '../haptics';
import { font, radius, space, useTheme } from '../theme';
import { Icon } from './Icon';

type ToastOptions = {
  message: string;
  tone?: 'success' | 'warning' | 'neutral';
  /** A follow-up the user can take, e.g. undo a delete. */
  actionLabel?: string;
  onAction?: () => void;
};

type ToastContextValue = { show: (options: ToastOptions) => void };

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

const DURATION_MS = 4000;
/** Toasts with an action stay longer so there is time to reach it. */
const ACTION_DURATION_MS = 7000;

/** Brief confirmations at the bottom of the screen ("Đã lưu", "Đã xoá · Hoàn tác"). */
export function ToastProvider({ children, bottomOffset = 76 }: { children: ReactNode; bottomOffset?: number }) {
  const { colors } = useTheme();
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...options, key: Date.now() });
    haptic(options.tone === 'warning' ? 'warning' : options.tone === 'success' ? 'success' : 'light');
    AccessibilityInfo.announceForAccessibility(options.message);
    timer.current = setTimeout(() => setToast(null), options.onAction ? ACTION_DURATION_MS : DURATION_MS);
  }, []);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const value = useMemo(() => ({ show }), [show]);
  const accent = toast?.tone === 'warning' ? colors.warning : toast?.tone === 'success' ? colors.income : colors.primary;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: space.md, right: space.md, bottom: bottomOffset, alignItems: 'center' }}
        >
          <View
            key={toast.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              maxWidth: 520,
              width: '100%',
              paddingVertical: 10,
              paddingLeft: space.md,
              paddingRight: 6,
              minHeight: 52,
              borderRadius: radius.md,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderLeftWidth: 4,
              borderLeftColor: accent,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            <Icon name={toast.tone === 'warning' ? 'alert' : 'check'} size={18} color={accent} />
            <Text style={{ flex: 1, fontSize: font.body, color: colors.text, lineHeight: 20 }}>{toast.message}</Text>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                onPress={() => {
                  toast.onAction?.();
                  hide();
                }}
                accessibilityRole="button"
                accessibilityLabel={toast.actionLabel}
                hitSlop={8}
                style={{ paddingHorizontal: 10, minHeight: 40, justifyContent: 'center' }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.body }}>{toast.actionLabel}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={hide} accessibilityRole="button" accessibilityLabel="Ẩn thông báo" hitSlop={8} style={{ padding: 8 }}>
                <Icon name="close" size={14} color={colors.muted} />
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
