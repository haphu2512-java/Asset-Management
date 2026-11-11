import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  View,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * Keyboard handling shared by every form in the app.
 *
 * Android now draws apps edge-to-edge, so the window no longer shrinks when
 * the keyboard opens (and `KeyboardAvoidingView` was switched off on Android
 * anyway). Inputs near the bottom of a sheet or screen ended up under the
 * keyboard. Instead of relying on the window resizing, we measure how much of
 * a view the keyboard actually covers and make room for exactly that much.
 * Because we measure the real overlap, this stays correct on devices where the
 * window does still resize (the overlap is then 0).
 */

/** Space kept between the focused input and the top of the keyboard. */
const FOCUS_MARGIN = 32;

const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };

function measure(node: Measurable | null | undefined): Promise<{ y: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!node?.measureInWindow) return resolve(null);
    node.measureInWindow((_x, y, _w, height) => resolve({ y, height }));
  });
}

/** How many pixels of the view behind `ref` are covered by the keyboard (0 when it is closed). */
export function useKeyboardOverlap(ref: RefObject<View | null>, onShown?: () => void): number {
  const [overlap, setOverlap] = useState(0);
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(SHOW_EVENT, async (e: KeyboardEvent) => {
      const box = await measure(ref.current);
      const keyboardTop = e.endCoordinates.screenY;
      const next = box ? Math.max(0, Math.round(box.y + box.height - keyboardTop)) : e.endCoordinates.height;
      setOverlap(next);
      onShownRef.current?.();
    });
    const hide = Keyboard.addListener(HIDE_EVENT, () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ref]);

  return overlap;
}

/** A plain View that pads its bottom by the part the keyboard covers, lifting e.g. a chat composer above it. */
export function KeyboardAvoidingBox({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ref = useRef<View>(null);
  const overlap = useKeyboardOverlap(ref);
  return (
    <View ref={ref} style={[style, overlap ? { paddingBottom: overlap } : null]}>
      {children}
    </View>
  );
}

/**
 * Drop-in ScrollView for forms: adds room under the content for the keyboard
 * and scrolls the focused input so it sits above the keyboard, both when the
 * keyboard opens and when the user taps another field while it is open.
 */
export function KeyboardAwareScrollView({
  style,
  contentContainerStyle,
  children,
  onScroll,
  ...rest
}: ScrollViewProps & { children: ReactNode }) {
  const box = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const overlapRef = useRef(0);

  const revealFocused = useCallback(async () => {
    const input = TextInput.State.currentlyFocusedInput?.() as unknown as Measurable | null;
    if (!input || overlapRef.current <= 0) return;
    const [field, frame] = await Promise.all([measure(input), measure(box.current)]);
    if (!field || !frame) return;
    const visibleTop = frame.y;
    const visibleBottom = frame.y + frame.height - overlapRef.current;
    let delta = 0;
    if (field.y + field.height + FOCUS_MARGIN > visibleBottom) delta = field.y + field.height + FOCUS_MARGIN - visibleBottom;
    else if (field.y < visibleTop) delta = field.y - visibleTop - FOCUS_MARGIN;
    if (delta) scroll.current?.scrollTo({ y: Math.max(0, offset.current + delta), animated: true });
  }, []);

  // Wait a frame so the extra bottom padding is laid out before scrolling into it.
  const revealSoon = useCallback(() => setTimeout(revealFocused, 80), [revealFocused]);
  const overlap = useKeyboardOverlap(box, revealSoon);
  overlapRef.current = overlap;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  return (
    <View ref={box} style={[{ flexGrow: 1, flexShrink: 1 }, style]} onTouchEnd={() => (overlapRef.current > 0 ? setTimeout(revealFocused, 250) : undefined)}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        {...rest}
        onScroll={handleScroll}
        contentContainerStyle={[contentContainerStyle, overlap ? { paddingBottom: overlap + FOCUS_MARGIN } : null]}
      >
        {children}
      </ScrollView>
    </View>
  );
}
