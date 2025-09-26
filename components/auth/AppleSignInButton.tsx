import * as AppleAuthentication from 'expo-apple-authentication';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { IOSBorderRadius, IOSColors, IOSSpacing, IOSTypography } from '../ui/ios-design-system';

interface AppleSignInButtonProps {
  onSignInStart?: () => void;
  onSignInComplete?: () => void;
  onSignInError?: (error: any) => void;
}

const AppleSignInButton: React.FC<AppleSignInButtonProps> = ({
  onSignInStart,
  onSignInComplete,
  onSignInError,
}) => {
  const { signInWithApple, isLoading } = useAuth();

  const handleSignIn = async () => {
    try {
      onSignInStart?.();
      await signInWithApple();
      onSignInComplete?.();
    } catch (error) {
      console.error('❌ Sign-in error in button component:', error);
      onSignInError?.(error);
    }
  };

  // On iOS, use the native Apple Authentication button
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.container}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={IOSBorderRadius.md}
          style={styles.appleButton}
          onPress={handleSignIn}
          disabled={isLoading}
        />
        
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Signing in...</Text>
          </View>
        )}
      </View>
    );
  }

  // Fallback for non-iOS platforms (for development/testing)
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.fallbackButton, isLoading && styles.disabledButton]}
        onPress={handleSignIn}
        disabled={isLoading}
      >
        <Text style={styles.fallbackButtonText}>
          {isLoading ? 'Signing in...' : 'Sign in with Apple (iOS Only)'}
        </Text>
      </TouchableOpacity>
      
      {Platform.OS !== 'ios' && (
        <Text style={styles.platformNote}>
          Apple Sign-In is only available on iOS devices
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  
  // Native Apple button styles
  appleButton: {
    width: 280,
    height: 50,
  },
  
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: IOSBorderRadius.md,
  },
  
  loadingText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemBackground,
    fontWeight: '600',
  },
  
  // Fallback button styles (for non-iOS)
  fallbackButton: {
    backgroundColor: '#000000',
    paddingHorizontal: IOSSpacing.xl,
    paddingVertical: IOSSpacing.md,
    borderRadius: IOSBorderRadius.md,
    minWidth: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  disabledButton: {
    opacity: 0.6,
  },
  
  fallbackButtonText: {
    ...IOSTypography.headline,
    color: IOSColors.systemBackground,
    fontWeight: '600',
  },
  
  platformNote: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    marginTop: IOSSpacing.sm,
    maxWidth: 280,
  },
});

export default AppleSignInButton;
