import type { ComponentProps } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

export type IconName =
  // Tab icons
  | 'overview'
  | 'assets'
  | 'transactions'
  | 'goals'
  | 'advisor'
  // Asset category icons
  | 'cash'
  | 'bank'
  | 'saving'
  | 'stock'
  | 'crypto'
  | 'lent'
  | 'debt'
  // Transaction category icons
  | 'salary'
  | 'bonus'
  | 'investment'
  | 'other-income'
  | 'food'
  | 'transport'
  | 'housing'
  | 'bills'
  | 'shopping'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'other-expense'
  // UI & Action icons
  | 'logout'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'chevron-left'
  | 'chevron-right'
  | 'camera'
  | 'refresh'
  | 'check'
  | 'close'
  | 'calendar'
  | 'clock'
  | 'sparkles'
  | 'trending-up'
  | 'trending-down'
  | 'arrow-up'
  | 'arrow-down'
  | 'minus'
  | 'wallet'
  | 'shield'
  | 'pie-chart'
  | 'scale';

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: ComponentProps<typeof Svg>['style'];
};

export function Icon({
  name,
  size = 20,
  color = '#0F172A',
  strokeWidth = 2,
  style,
}: IconProps) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style,
  };

  switch (name) {
    // ----------------------------------------------------
    // Tabs
    // ----------------------------------------------------
    case 'overview':
      return (
        <Svg {...commonProps}>
          <Rect x="3" y="3" width="7" height="9" rx="1.5" />
          <Rect x="14" y="3" width="7" height="5" rx="1.5" />
          <Rect x="14" y="12" width="7" height="9" rx="1.5" />
          <Rect x="3" y="16" width="7" height="5" rx="1.5" />
        </Svg>
      );

    case 'assets':
    case 'wallet':
      return (
        <Svg {...commonProps}>
          <Path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h3v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V7" />
          <Circle cx="18" cy="14" r="1" fill={color} />
        </Svg>
      );

    case 'transactions':
      return (
        <Svg {...commonProps}>
          <Path d="M7 10h14l-4-4" />
          <Path d="M17 14H3l4 4" />
        </Svg>
      );

    case 'goals':
      return (
        <Svg {...commonProps}>
          <Circle cx="12" cy="12" r="10" />
          <Circle cx="12" cy="12" r="6" />
          <Circle cx="12" cy="12" r="2" />
        </Svg>
      );

    case 'advisor':
    case 'sparkles':
      return (
        <Svg {...commonProps}>
          <Path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          <Path d="M5 3v4" />
          <Path d="M3 5h4" />
          <Path d="M19 17v4" />
          <Path d="M17 19h4" />
        </Svg>
      );

    // ----------------------------------------------------
    // Asset Categories
    // ----------------------------------------------------
    case 'cash':
      return (
        <Svg {...commonProps}>
          <Rect x="2" y="6" width="20" height="12" rx="2" />
          <Circle cx="12" cy="12" r="2" />
          <Path d="M6 12h.01M18 12h.01" />
        </Svg>
      );

    case 'bank':
      return (
        <Svg {...commonProps}>
          <Line x1="3" y1="21" x2="21" y2="21" />
          <Line x1="6" y1="18" x2="6" y2="11" />
          <Line x1="10" y1="18" x2="10" y2="11" />
          <Line x1="14" y1="18" x2="14" y2="11" />
          <Line x1="18" y1="18" x2="18" y2="11" />
          <Polygon points="12 2 20 7 4 7" />
        </Svg>
      );

    case 'saving':
      return (
        <Svg {...commonProps}>
          <Rect x="3" y="4" width="18" height="16" rx="2" />
          <Circle cx="12" cy="12" r="4" />
          <Line x1="12" y1="10" x2="12" y2="14" />
          <Line x1="10" y1="12" x2="14" y2="12" />
        </Svg>
      );

    case 'stock':
      return (
        <Svg {...commonProps}>
          <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <Polyline points="16 7 22 7 22 13" />
        </Svg>
      );

    case 'crypto':
      return (
        <Svg {...commonProps}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M9 8h4.5a2.5 2.5 0 0 1 0 5H9m0 0h5a2.5 2.5 0 0 1 0 5H9m0-10v10" />
          <Line x1="11" y1="6" x2="11" y2="8" />
          <Line x1="13" y1="6" x2="13" y2="8" />
          <Line x1="11" y1="18" x2="11" y2="20" />
          <Line x1="13" y1="18" x2="13" y2="20" />
        </Svg>
      );

    case 'lent':
      return (
        <Svg {...commonProps}>
          <Circle cx="12" cy="12" r="9" />
          <Polyline points="9 9 15 9 15 15" />
          <Line x1="9" y1="15" x2="15" y2="9" />
        </Svg>
      );

    case 'debt':
      return (
        <Svg {...commonProps}>
          <Circle cx="12" cy="12" r="9" />
          <Polyline points="15 9 15 15 9 15" />
          <Line x1="9" y1="9" x2="15" y2="15" />
        </Svg>
      );

    // ----------------------------------------------------
    // Transaction Categories
    // ----------------------------------------------------
    case 'salary':
      return (
        <Svg {...commonProps}>
          <Rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </Svg>
      );

    case 'bonus':
      return (
        <Svg {...commonProps}>
          <Circle cx="12" cy="8" r="6" />
          <Path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1" />
        </Svg>
      );

    case 'investment':
      return (
        <Svg {...commonProps}>
          <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <Polyline points="16 7 22 7 22 13" />
        </Svg>
      );

    case 'other-income':
      return (
        <Svg {...commonProps}>
          <Circle cx="12" cy="12" r="10" />
          <Line x1="12" y1="8" x2="12" y2="16" />
          <Line x1="8" y1="12" x2="16" y2="12" />
        </Svg>
      );

    case 'food':
      return (
        <Svg {...commonProps}>
          <Path d="M18 2v20M14 2v4a2 2 0 0 0 2 2h2M6 2v6a3 3 0 0 0 3 3v11M3 2v6a3 3 0 0 0 3 3M9 2v6a3 3 0 0 0 3 3" />
        </Svg>
      );

    case 'transport':
      return (
        <Svg {...commonProps}>
          <Path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 11.3 2 12v4c0 .6.4 1 1 1h2" />
          <Circle cx="7" cy="17" r="2" />
          <Circle cx="17" cy="17" r="2" />
        </Svg>
      );

    case 'housing':
      return (
        <Svg {...commonProps}>
          <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <Polyline points="9 22 9 12 15 12 15 22" />
        </Svg>
      );

    case 'bills':
      return (
        <Svg {...commonProps}>
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <Polyline points="14 2 14 8 20 8" />
          <Line x1="16" y1="13" x2="8" y2="13" />
          <Line x1="16" y1="17" x2="8" y2="17" />
        </Svg>
      );

    case 'shopping':
      return (
        <Svg {...commonProps}>
          <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <Line x1="3" y1="6" x2="21" y2="6" />
          <Path d="M16 10a4 4 0 0 1-8 0" />
        </Svg>
      );

    case 'entertainment':
      return (
        <Svg {...commonProps}>
          <Rect x="2" y="6" width="20" height="12" rx="2" />
          <Line x1="6" y1="12" x2="10" y2="12" />
          <Line x1="8" y1="10" x2="8" y2="14" />
          <Circle cx="15" cy="12" r="1" fill={color} />
          <Circle cx="18" cy="10" r="1" fill={color} />
        </Svg>
      );

    case 'health':
      return (
        <Svg {...commonProps}>
          <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </Svg>
      );

    case 'education':
      return (
        <Svg {...commonProps}>
          <Path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <Path d="M6 12v5c3 3 9 3 12 0v-5" />
        </Svg>
      );

    case 'other-expense':
      return (
        <Svg {...commonProps}>
          <Circle cx="12" cy="12" r="10" />
          <Line x1="8" y1="12" x2="16" y2="12" />
        </Svg>
      );

    // ----------------------------------------------------
    // Actions & General UI
    // ----------------------------------------------------
    case 'logout':
      return (
        <Svg {...commonProps}>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <Polyline points="16 17 21 12 16 7" />
          <Line x1="21" y1="12" x2="9" y2="12" />
        </Svg>
      );

    case 'plus':
      return (
        <Svg {...commonProps}>
          <Line x1="12" y1="5" x2="12" y2="19" />
          <Line x1="5" y1="12" x2="19" y2="12" />
        </Svg>
      );

    case 'edit':
      return (
        <Svg {...commonProps}>
          <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </Svg>
      );

    case 'trash':
      return (
        <Svg {...commonProps}>
          <Polyline points="3 6 5 6 21 6" />
          <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </Svg>
      );

    case 'chevron-left':
      return (
        <Svg {...commonProps}>
          <Polyline points="15 18 9 12 15 6" />
        </Svg>
      );

    case 'chevron-right':
      return (
        <Svg {...commonProps}>
          <Polyline points="9 18 15 12 9 6" />
        </Svg>
      );

    case 'camera':
      return (
        <Svg {...commonProps}>
          <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <Circle cx="12" cy="13" r="4" />
        </Svg>
      );

    case 'refresh':
      return (
        <Svg {...commonProps}>
          <Path d="M21.5 2v6h-6M2.5 22v-6h6" />
          <Path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2" />
        </Svg>
      );

    case 'check':
      return (
        <Svg {...commonProps}>
          <Polyline points="20 6 9 17 4 12" />
        </Svg>
      );

    case 'close':
      return (
        <Svg {...commonProps}>
          <Line x1="18" y1="6" x2="6" y2="18" />
          <Line x1="6" y1="6" x2="18" y2="18" />
        </Svg>
      );

    case 'calendar':
      return (
        <Svg {...commonProps}>
          <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <Line x1="16" y1="2" x2="16" y2="6" />
          <Line x1="8" y1="2" x2="8" y2="6" />
          <Line x1="3" y1="10" x2="21" y2="10" />
        </Svg>
      );

    case 'clock':
      return (
        <Svg {...commonProps}>
          <Circle cx="12" cy="12" r="10" />
          <Polyline points="12 6 12 12 16 14" />
        </Svg>
      );

    case 'trending-up':
      return (
        <Svg {...commonProps}>
          <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <Polyline points="17 6 23 6 23 12" />
        </Svg>
      );

    case 'trending-down':
      return (
        <Svg {...commonProps}>
          <Polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <Polyline points="17 18 23 18 23 12" />
        </Svg>
      );

    case 'arrow-up':
      return (
        <Svg {...commonProps}>
          <Line x1="12" y1="19" x2="12" y2="5" />
          <Polyline points="5 12 12 5 19 12" />
        </Svg>
      );

    case 'arrow-down':
      return (
        <Svg {...commonProps}>
          <Line x1="12" y1="5" x2="12" y2="19" />
          <Polyline points="19 12 12 19 5 12" />
        </Svg>
      );

    case 'minus':
      return (
        <Svg {...commonProps}>
          <Line x1="5" y1="12" x2="19" y2="12" />
        </Svg>
      );

    case 'shield':
      return (
        <Svg {...commonProps}>
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </Svg>
      );

    case 'pie-chart':
      return (
        <Svg {...commonProps}>
          <Path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <Path d="M22 12A10 10 0 0 0 12 2v10z" />
        </Svg>
      );

    case 'scale':
      return (
        <Svg {...commonProps}>
          <Path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <Path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <Path d="M7 21h10" />
          <Path d="M12 3v18" />
          <Path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </Svg>
      );

    default:
      return (
        <Svg {...commonProps}>
          <Circle cx="12" cy="12" r="10" />
        </Svg>
      );
  }
}

/**
 * Renders a circular badge with a tinted background and an icon matching the category color.
 */
export function CategoryBadge({
  icon,
  color,
  size = 28,
  iconSize = 14,
}: {
  icon: IconName;
  color: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}18`, // 10% opacity tint
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={iconSize} color={color} strokeWidth={2.2} />
    </View>
  );
}

export function getCategoryIcon(id: string): IconName {
  const map: Record<string, IconName> = {
    cash: 'cash',
    bank: 'bank',
    saving: 'saving',
    stock: 'stock',
    crypto: 'crypto',
    lent: 'lent',
    debt: 'debt',
    salary: 'salary',
    bonus: 'bonus',
    investment: 'investment',
    'other-income': 'other-income',
    food: 'food',
    transport: 'transport',
    housing: 'housing',
    bills: 'bills',
    shopping: 'shopping',
    entertainment: 'entertainment',
    health: 'health',
    education: 'education',
    'other-expense': 'other-expense',
  };
  return map[id] ?? 'other-expense';
}

