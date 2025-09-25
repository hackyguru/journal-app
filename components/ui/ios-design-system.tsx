// Native iOS Design System for Memory App
import { Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// iOS System Colors (matches iOS Human Interface Guidelines)
export const IOSColors = {
  // iOS System Colors
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemIndigo: '#5856D6',
  systemOrange: '#FF9500',
  systemPink: '#FF2D92',
  systemPurple: '#AF52DE',
  systemRed: '#FF3B30',
  systemTeal: '#5AC8FA',
  systemYellow: '#FFCC00',

  // iOS Gray Colors
  systemGray: '#8E8E93',
  systemGray2: '#AEAEB2',
  systemGray3: '#C7C7CC',
  systemGray4: '#D1D1D6',
  systemGray5: '#E5E5EA',
  systemGray6: '#F2F2F7',

  // iOS Background Colors
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#F2F2F7',
  tertiarySystemBackground: '#FFFFFF',
  systemGroupedBackground: '#F2F2F7',
  secondarySystemGroupedBackground: '#FFFFFF',
  tertiarySystemGroupedBackground: '#F2F2F7',

  // iOS Label Colors
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C43',
  quaternaryLabel: '#2C2C2E',

  // iOS Separator Colors
  separator: '#3C3C4329', // 16% opacity
  opaqueSeparator: '#C6C6C8',

  // iOS Fill Colors
  systemFill: '#78788033', // 20% opacity
  secondarySystemFill: '#78788028', // 16% opacity
  tertiarySystemFill: '#7878801E', // 12% opacity
  quaternarySystemFill: '#74748014', // 8% opacity
};

// iOS Typography (San Francisco font system)
export const IOSTypography = StyleSheet.create({
  // Large Title
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'System',
  } as TextStyle,

  // Title 1
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'System',
  } as TextStyle,

  // Title 2
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'System',
  } as TextStyle,

  // Title 3
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'System',
  } as TextStyle,

  // Headline
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  } as TextStyle,

  // Body
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    color: IOSColors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  } as TextStyle,

  // Callout
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    color: IOSColors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  } as TextStyle,

  // Subhead
  subhead: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    color: IOSColors.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  } as TextStyle,

  // Footnote
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: IOSColors.secondaryLabel,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  } as TextStyle,

  // Caption 1
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: IOSColors.secondaryLabel,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  } as TextStyle,

  // Caption 2
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400',
    color: IOSColors.secondaryLabel,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'System',
  } as TextStyle,
});

// iOS Spacing (based on 8pt grid system)
export const IOSSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

// iOS Border Radius
export const IOSBorderRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

// iOS Shadows (subtle, native-looking)
export const IOSShadows = StyleSheet.create({
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  } as ViewStyle,
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  } as ViewStyle,
});

// iOS Button Styles
export const IOSButtonStyles = StyleSheet.create({
  // Primary Button (iOS Blue)
  primary: {
    backgroundColor: IOSColors.systemBlue,
    borderRadius: IOSBorderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44, // iOS minimum touch target
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  // Secondary Button (Gray outline)
  secondary: {
    backgroundColor: 'transparent',
    borderColor: IOSColors.systemGray3,
    borderWidth: 1,
    borderRadius: IOSBorderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  // Tertiary Button (Text only)
  tertiary: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  // Destructive Button (iOS Red)
  destructive: {
    backgroundColor: IOSColors.systemRed,
    borderRadius: IOSBorderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
});

// iOS Button Text Styles
export const IOSButtonTextStyles = StyleSheet.create({
  primary: {
    ...IOSTypography.headline,
    color: '#FFFFFF',
    textAlign: 'center',
  } as TextStyle,
  secondary: {
    ...IOSTypography.headline,
    color: IOSColors.systemBlue,
    textAlign: 'center',
  } as TextStyle,
  tertiary: {
    ...IOSTypography.headline,
    color: IOSColors.systemBlue,
    textAlign: 'center',
  } as TextStyle,
  destructive: {
    ...IOSTypography.headline,
    color: '#FFFFFF',
    textAlign: 'center',
  } as TextStyle,
});

// iOS Card Styles (native iOS grouped table view style)
export const IOSCardStyles = StyleSheet.create({
  // Standard iOS grouped cell
  grouped: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: IOSBorderRadius.lg,
    marginHorizontal: IOSSpacing.md,
    marginVertical: IOSSpacing.xs,
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.md,
  } as ViewStyle,

  // Inset grouped (iOS 13+ style)
  insetGrouped: {
    backgroundColor: IOSColors.tertiarySystemGroupedBackground,
    borderRadius: IOSBorderRadius.xl,
    marginHorizontal: IOSSpacing.md,
    marginVertical: IOSSpacing.sm,
    paddingHorizontal: IOSSpacing.lg,
    paddingVertical: IOSSpacing.lg,
    ...IOSShadows.small,
  } as ViewStyle,

  // Plain cell (no background)
  plain: {
    backgroundColor: 'transparent',
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
  } as ViewStyle,
});

// Safe Area Utilities
export const useIOSSafeAreaStyles = () => {
  const insets = useSafeAreaInsets();
  
  return StyleSheet.create({
    safeAreaTop: {
      paddingTop: insets.top,
    },
    safeAreaBottom: {
      paddingBottom: insets.bottom,
    },
    safeAreaLeft: {
      paddingLeft: insets.left,
    },
    safeAreaRight: {
      paddingRight: insets.right,
    },
    safeAreaHorizontal: {
      paddingLeft: insets.left,
      paddingRight: insets.right,
    },
    safeAreaVertical: {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    safeAreaAll: {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    },
  });
};

// iOS Common Layout Styles
export const IOSLayoutStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOSColors.systemGroupedBackground,
  } as ViewStyle,
  
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,
  
  section: {
    marginTop: IOSSpacing.lg,
    marginBottom: IOSSpacing.md,
  } as ViewStyle,
  
  sectionHeader: {
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.sm,
  } as ViewStyle,
});
