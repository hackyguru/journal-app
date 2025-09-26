import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

// User interface
export interface User {
  id: string;
  email?: string;
  fullName?: string;
  identityToken: string;
  authorizationCode?: string;
  createdAt: string;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys
const USER_STORAGE_KEY = '@memory_app_user';
const AUTH_SESSION_KEY = '@memory_app_auth_session';

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated
  const isAuthenticated = user !== null;

  // Load user from storage on app start
  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      setIsLoading(true);
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
      
      if (storedUser) {
        const userData: User = JSON.parse(storedUser);
        
        // Verify the stored session is still valid
        if (Platform.OS === 'ios') {
          try {
            // Check if Apple Authentication is still available
            const isAvailable = await AppleAuthentication.isAvailableAsync();
            if (isAvailable) {
              // Verify credential state
              const credentialState = await AppleAuthentication.getCredentialStateAsync(userData.id);
              
              if (credentialState === AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED) {
                setUser(userData);
                console.log('✅ User session restored:', userData.email || userData.id);
              } else {
                console.log('⚠️ Apple credential state changed, signing out');
                await signOut();
              }
            } else {
              console.log('⚠️ Apple Authentication not available');
              await signOut();
            }
          } catch (error) {
            console.error('❌ Error verifying Apple credential:', error);
            // Keep user signed in even if verification fails (network issues, etc.)
            setUser(userData);
          }
        } else {
          // On non-iOS platforms, just restore the user
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('❌ Error loading stored user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithApple = async () => {
    try {
      setIsLoading(true);

      // Check if Apple Authentication is available (iOS only)
      if (Platform.OS !== 'ios') {
        Alert.alert('Not Available', 'Apple Sign-In is only available on iOS devices.');
        return;
      }

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Not Available', 'Apple Sign-In is not available on this device.');
        return;
      }

      // Request Apple Authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('🍎 Apple Sign-In successful:', {
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
      });

      // Create user object
      const newUser: User = {
        id: credential.user,
        email: credential.email || undefined,
        fullName: credential.fullName ? 
          `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() : 
          undefined,
        identityToken: credential.identityToken || '',
        authorizationCode: credential.authorizationCode || undefined,
        createdAt: new Date().toISOString(),
      };

      // Store user data
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
        signedInAt: new Date().toISOString(),
        platform: Platform.OS,
      }));

      setUser(newUser);

      // TODO: Send identity token to backend for verification and user creation
      // This will be implemented in Phase 2
      console.log('✅ User signed in and stored locally');

    } catch (error: any) {
      console.error('❌ Apple Sign-In error:', error);
      
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in request
        console.log('ℹ️ User canceled Apple Sign-In');
      } else {
        Alert.alert(
          'Sign-In Error',
          'There was a problem signing in with Apple. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Clear stored user data
      await AsyncStorage.multiRemove([USER_STORAGE_KEY, AUTH_SESSION_KEY]);
      
      // TODO: Notify backend of sign-out (Phase 2)
      
      setUser(null);
      console.log('✅ User signed out');
      
    } catch (error) {
      console.error('❌ Error during sign-out:', error);
      Alert.alert('Error', 'There was a problem signing out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAuth = async () => {
    console.log('🔄 Refreshing authentication...');
    await loadStoredUser();
  };

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    signInWithApple,
    signOut,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to get user ID for API calls
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      const userData: User = JSON.parse(storedUser);
      return userData.id;
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting current user ID:', error);
    return null;
  }
};

export default AuthContext;
