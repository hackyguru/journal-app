import React, { useRef, useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSBorderRadius, IOSColors, IOSSpacing, IOSTypography, useIOSSafeAreaStyles } from '../ui/ios-design-system';
import AppleSignInButton from './AppleSignInButton';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - (IOSSpacing.xl * 2);

// Feature cards data
const features = [
  {
    id: 1,
    icon: '🎙️',
    title: 'Record memories',
    description: 'Capture your thoughts with voice recordings, automatically transcribed by AI',
    gradient: ['#667eea', '#764ba2']
  },
  {
    id: 2,
    icon: '🧠',
    title: 'Build a second brain',
    description: 'Create a searchable knowledge base of your personal experiences and insights',
    gradient: ['#f093fb', '#f5576c']
  },
  {
    id: 3,
    icon: '💭',
    title: 'Preserve your thoughts',
    description: 'Keep your memories safe and organized, accessible whenever you need them',
    gradient: ['#4facfe', '#00f2fe']
  }
];

const LoginScreen: React.FC = () => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const safeAreaStyles = useIOSSafeAreaStyles();

  const handleSignInStart = () => {
    setIsSigningIn(true);
  };

  const handleSignInComplete = () => {
    setIsSigningIn(false);
    console.log('✅ Sign-in completed successfully');
  };

  const handleSignInError = (error: any) => {
    setIsSigningIn(false);
    console.error('❌ Sign-in error:', error);
    
    // Handle different types of Apple Sign-In errors gracefully
    if (error.code === 'ERR_REQUEST_CANCELED') {
      // User canceled - no need to show error
      return;
    }
    
    let title = 'Sign-In Error';
    let message = 'There was a problem signing in. Please try again.';
    
    // Provide specific error messages for common issues
    if (error.message?.includes('authorization attempt failed')) {
      title = 'Apple Sign-In Unavailable';
      message = 'Apple Sign-In is currently unavailable. This might be because:\n\n• You\'re using Expo Go (Apple Sign-In requires a native build)\n• Network connectivity issues\n• Apple\'s servers are temporarily unavailable\n\nPlease try again later or contact support if the issue persists.';
    } else if (error.message?.includes('not available')) {
      title = 'Feature Not Available';
      message = 'Apple Sign-In is not available on this device or in this environment. Please ensure you\'re using a physical iOS device with a native build of the app.';
    } else if (error.message?.includes('network')) {
      title = 'Network Error';
      message = 'Please check your internet connection and try again.';
    }
    
    Alert.alert(
      title,
      message,
      [
        { text: 'OK', style: 'default' },
        { 
          text: 'Try Again', 
          style: 'default',
          onPress: () => {
            // Reset state and allow user to try again
            setIsSigningIn(false);
          }
        }
      ]
    );
  };

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH);
    setCurrentSlide(slideIndex);
  };

  const scrollToSlide = (index: number) => {
    scrollViewRef.current?.scrollTo({
      x: index * CARD_WIDTH,
      animated: true,
    });
    setCurrentSlide(index);
  };

  return (
    <SafeAreaView style={[styles.container, safeAreaStyles.container]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Your AI pocket biographer</Text>
          <Text style={styles.subtitle}>Capture, organize, and chat with your memories</Text>
        </View>

        {/* Feature Carousel */}
        <View style={styles.carouselContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.carouselContent}
          >
            {features.map((feature, index) => (
              <View key={feature.id} style={styles.featureCard}>
                <View style={styles.cardContent}>
                  <View style={styles.iconContainer}>
                    <Text style={styles.featureIcon}>{feature.icon}</Text>
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Pagination Dots */}
          <View style={styles.pagination}>
            {features.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.paginationDot,
                  currentSlide === index && styles.paginationDotActive
                ]}
                onPress={() => scrollToSlide(index)}
              />
            ))}
          </View>
        </View>

        {/* Sign In Section */}
        <View style={styles.signInSection}>
          <AppleSignInButton
            onSignInStart={handleSignInStart}
            onSignInComplete={handleSignInComplete}
            onSignInError={handleSignInError}
          />
          
          {isSigningIn && (
            <Text style={styles.signingInText}>
              Signing you in securely...
            </Text>
          )}

          {/* Development Note - Only show in development */}
          {__DEV__ && (
            <Text style={styles.devNote}>
              💡 Note: Apple Sign-In requires a native build. Use EAS Build for full functionality.
            </Text>
          )}

          {/* Privacy Notice */}
          <Text style={styles.privacyText}>
            We use Apple Sign-In to protect your privacy. Your memories are stored securely and never shared.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOSColors.systemBackground,
  },
  
  content: {
    flex: 1,
    paddingHorizontal: IOSSpacing.xl,
    justifyContent: 'space-between',
  },
  
  // Title Section - Fixed height
  titleSection: {
    alignItems: 'center',
    paddingTop: IOSSpacing.lg,
    paddingBottom: IOSSpacing.md,
  },
  
  mainTitle: {
    ...IOSTypography.largeTitle,
    color: IOSColors.label,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: IOSSpacing.xs,
    lineHeight: 38,
  },
  
  subtitle: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 20,
  },
  
  // Carousel Section - Takes available space
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: IOSSpacing.md,
  },
  
  carouselContent: {
    paddingHorizontal: 0,
  },
  
  featureCard: {
    width: CARD_WIDTH,
    marginHorizontal: 0,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: IOSBorderRadius.xl,
    padding: IOSSpacing.xl,
    shadowColor: IOSColors.label,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  
  cardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 240, // Fixed height to ensure consistency
  },
  
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: IOSColors.systemBlue + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IOSSpacing.lg,
  },
  
  featureIcon: {
    fontSize: 28,
  },
  
  featureTitle: {
    ...IOSTypography.title2,
    color: IOSColors.label,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: IOSSpacing.sm,
  },
  
  featureDescription: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  
  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: IOSSpacing.lg,
    height: 20, // Fixed height
  },
  
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOSColors.systemGray4,
    marginHorizontal: 4,
  },
  
  paginationDotActive: {
    backgroundColor: IOSColors.systemBlue,
    width: 20,
  },
  
  // Sign In Section - Fixed height at bottom
  signInSection: {
    alignItems: 'center',
    paddingTop: IOSSpacing.md,
    paddingBottom: IOSSpacing['2xl'], // Increased bottom padding
    marginBottom: IOSSpacing.lg,      // Added margin for extra gap
  },
  
  signingInText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemBlue,
    marginTop: IOSSpacing.md,
    fontWeight: '500',
  },
  
  devNote: {
    ...IOSTypography.caption2,
    color: IOSColors.systemOrange,
    textAlign: 'center',
    lineHeight: 14,
    marginTop: IOSSpacing.sm,
    maxWidth: 300,
    backgroundColor: IOSColors.systemOrange + '10',
    paddingHorizontal: IOSSpacing.sm,
    paddingVertical: IOSSpacing.xs,
    borderRadius: IOSBorderRadius.sm,
  },
  
  privacyText: {
    ...IOSTypography.caption1,
    color: IOSColors.tertiaryLabel,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: IOSSpacing.md,
    maxWidth: 280,
  },
});

export default LoginScreen;
