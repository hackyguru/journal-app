import { Dimensions, Platform } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// Modern Color Palette (inspired by the screenshots)
export const ModernColors = {
  // Backgrounds
  background: '#F8F9FA',           // Light gray background
  cardBackground: '#FFFFFF',       // Pure white cards
  secondaryBackground: '#F5F6F7',  // Slightly darker gray
  
  // Text
  primary: '#1A1A1A',             // Dark text
  secondary: '#6B7280',           // Gray text
  tertiary: '#9CA3AF',            // Light gray text
  placeholder: '#D1D5DB',         // Placeholder text
  
  // Accents
  accent: '#3B82F6',              // Blue accent
  success: '#10B981',             // Green
  warning: '#F59E0B',             // Orange
  error: '#EF4444',               // Red
  
  // Borders & Separators
  border: '#E5E7EB',              // Light border
  separator: '#F3F4F6',           // Very light separator
  
  // Shadows
  shadow: 'rgba(0, 0, 0, 0.1)',   // Subtle shadow
  shadowDark: 'rgba(0, 0, 0, 0.15)', // Slightly darker shadow
};

// Modern Typography
export const ModernTypography = {
  // Headers
  largeTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 41,
    letterSpacing: -0.5,
  },
  
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  
  title2: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 25,
  },
  
  // Body text
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  
  callout: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 21,
  },
  
  subhead: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  
  caption1: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  
  caption2: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 13,
  },
};

// Modern Spacing
export const ModernSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

// Modern Border Radius
export const ModernBorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
};

// Modern Card Styles
export const ModernCardStyles = {
  base: {
    backgroundColor: ModernColors.cardBackground,
    borderRadius: ModernBorderRadius.lg,
    padding: ModernSpacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: ModernColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  
  compact: {
    backgroundColor: ModernColors.cardBackground,
    borderRadius: ModernBorderRadius.md,
    padding: ModernSpacing.md,
    ...Platform.select({
      ios: {
        shadowColor: ModernColors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  
  large: {
    backgroundColor: ModernColors.cardBackground,
    borderRadius: ModernBorderRadius.xl,
    padding: ModernSpacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: ModernColors.shadowDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
};

// Modern Layout Styles
export const ModernLayoutStyles = {
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  
  screenPadding: {
    paddingHorizontal: ModernSpacing.lg,
  },
  
  cardContainer: {
    marginHorizontal: ModernSpacing.lg,
    marginBottom: ModernSpacing.md,
  },
  
  section: {
    marginBottom: ModernSpacing.xl,
  },
  
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  
  spaceBetween: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
};

// Modern Button Styles
export const ModernButtonStyles = {
  primary: {
    backgroundColor: ModernColors.accent,
    borderRadius: ModernBorderRadius.md,
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  secondary: {
    backgroundColor: ModernColors.secondaryBackground,
    borderRadius: ModernBorderRadius.md,
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: ModernBorderRadius.md,
    paddingVertical: ModernSpacing.sm,
    paddingHorizontal: ModernSpacing.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};

// Modern Input Styles
export const ModernInputStyles = {
  base: {
    backgroundColor: ModernColors.cardBackground,
    borderRadius: ModernBorderRadius.md,
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.md,
    borderWidth: 1,
    borderColor: ModernColors.border,
    ...ModernTypography.body,
    color: ModernColors.primary,
  },
  
  multiline: {
    backgroundColor: ModernColors.cardBackground,
    borderRadius: ModernBorderRadius.md,
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.md,
    borderWidth: 1,
    borderColor: ModernColors.border,
    minHeight: 100,
    textAlignVertical: 'top' as const,
    ...ModernTypography.body,
    color: ModernColors.primary,
  },
};

// Screen dimensions helper
export const ModernDimensions = {
  screenWidth,
  cardWidth: screenWidth - (ModernSpacing.lg * 2),
  isSmallScreen: screenWidth < 375,
  isMediumScreen: screenWidth >= 375 && screenWidth < 414,
  isLargeScreen: screenWidth >= 414,
};
