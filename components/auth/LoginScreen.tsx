import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSColors, IOSSpacing, IOSTypography, useIOSSafeAreaStyles } from '../ui/ios-design-system';
import AppleSignInButton from './AppleSignInButton';

const LoginScreen: React.FC = () => {
  const [isSigningIn, setIsSigningIn] = useState(false);
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
    
    // Show user-friendly error message
    if (error.code !== 'ERR_REQUEST_CANCELED') {
      Alert.alert(
        'Sign-In Error',
        'There was a problem signing in. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, safeAreaStyles.container]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.appIcon}>🧠</Text>
          </View>
          <Text style={styles.appTitle}>Memory</Text>
          <Text style={styles.appSubtitle}>Your personal memory assistant</Text>
        </View>

        {/* Features Section */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>📝</Text>
            <Text style={styles.featureText}>Capture daily memories</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🎙️</Text>
            <Text style={styles.featureText}>Voice recordings with AI transcription</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>💬</Text>
            <Text style={styles.featureText}>Chat with your memories</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🔒</Text>
            <Text style={styles.featureText}>Secure and private</Text>
          </View>
        </View>

        {/* Sign In Section */}
        <View style={styles.signInSection}>
          <Text style={styles.signInTitle}>Get Started</Text>
          <Text style={styles.signInSubtitle}>
            Sign in with Apple to securely access your personal memories across all your devices.
          </Text>
          
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
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Text style={styles.privacyText}>
            We use Apple Sign-In to protect your privacy. Your memories are stored securely and are never shared with third parties.
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
    justifyContent: 'center',
  },
  
  // Header Section
  header: {
    alignItems: 'center',
    marginBottom: IOSSpacing['4xl'],
  },
  
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: IOSColors.systemBlue + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IOSSpacing.lg,
  },
  
  appIcon: {
    fontSize: 40,
  },
  
  appTitle: {
    ...IOSTypography.largeTitle,
    color: IOSColors.label,
    fontWeight: '700',
    marginBottom: IOSSpacing.xs,
  },
  
  appSubtitle: {
    ...IOSTypography.title3,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    fontWeight: '400',
  },
  
  // Features Section
  features: {
    marginBottom: IOSSpacing['4xl'],
  },
  
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: IOSSpacing.lg,
  },
  
  featureIcon: {
    fontSize: 24,
    marginRight: IOSSpacing.md,
    width: 30,
  },
  
  featureText: {
    ...IOSTypography.body,
    color: IOSColors.label,
    flex: 1,
  },
  
  // Sign In Section
  signInSection: {
    alignItems: 'center',
    marginBottom: IOSSpacing['3xl'],
  },
  
  signInTitle: {
    ...IOSTypography.title1,
    color: IOSColors.label,
    fontWeight: '600',
    marginBottom: IOSSpacing.sm,
  },
  
  signInSubtitle: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    marginBottom: IOSSpacing['2xl'],
    lineHeight: 22,
    maxWidth: 320,
  },
  
  signingInText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemBlue,
    marginTop: IOSSpacing.md,
    fontWeight: '500',
  },
  
  // Privacy Notice
  privacyNotice: {
    marginTop: 'auto',
    paddingBottom: IOSSpacing.lg,
  },
  
  privacyText: {
    ...IOSTypography.caption1,
    color: IOSColors.tertiaryLabel,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default LoginScreen;
