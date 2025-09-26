import DailyMemory from '@/components/daily-memory';
import { IOSBorderRadius, IOSColors, IOSLayoutStyles, IOSSpacing, IOSTypography, useIOSSafeAreaStyles } from '@/components/ui/ios-design-system';
import WeeklyCalendar from '@/components/weekly-calendar';
import { useAuth } from '@/contexts/AuthContext';
import { usePinecone } from '@/hooks/usePinecone';
import { getCurrentWeekStart, getTodayLocalDate } from '@/utils/dateUtils';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDate());
  const [memoryDates, setMemoryDates] = useState<Set<string>>(new Set());
  const { user, signOut } = useAuth();
  const { getWeekMemories } = usePinecone();
  const safeAreaStyles = useIOSSafeAreaStyles();

  const loadWeekMemories = async () => {
    const weekStart = getCurrentWeekStart();
    const result = await getWeekMemories(weekStart);
    
    if (result.success) {
      const dates = new Set<string>();
      Object.values(result.memories).forEach((day: any) => {
        if (day.hasMemory) {
          dates.add(day.date);
        }
      });
      setMemoryDates(dates);
    }
  };

  useEffect(() => {
    loadWeekMemories();
    // Ensure today is selected when app loads
    setSelectedDate(getTodayLocalDate());
  }, []);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleMemoryUpdate = (hasMemory: boolean) => {
    if (hasMemory) {
      setMemoryDates(prev => new Set([...prev, selectedDate]));
    } else {
      setMemoryDates(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedDate);
        return newSet;
      });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getTodayStatus = () => {
    const today = new Date().toISOString().split('T')[0];
    return memoryDates.has(today) ? 'Memory captured ✨' : 'Ready to capture today?';
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: () => signOut()
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={IOSColors.systemGroupedBackground} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.status}>{getTodayStatus()}</Text>
          {user && (
            <Text style={styles.userInfo}>
              {user.fullName || user.email || 'Signed in with Apple'}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <View style={styles.streakContainer}>
            <Text style={styles.streakNumber}>{memoryDates.size}</Text>
            <Text style={styles.streakLabel}>memories</Text>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={handleSignOut}>
            <Text style={styles.profileButtonText}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Weekly Calendar */}
        <WeeklyCalendar
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
          memoryDates={memoryDates}
        />

        {/* Daily Memory Section */}
        <DailyMemory 
          selectedDate={selectedDate}
          onMemoryUpdate={handleMemoryUpdate}
        />

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...IOSLayoutStyles.container,
  },
  header: {
    ...IOSLayoutStyles.spaceBetween,
    paddingHorizontal: IOSSpacing.md,
    paddingTop: IOSSpacing.lg,
    paddingBottom: IOSSpacing.md,
    backgroundColor: IOSColors.systemGroupedBackground,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOSSpacing.sm,
  },
  greeting: {
    ...IOSTypography.title2,
    marginBottom: 2,
    fontWeight: '600',
  },
  status: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
  },
  userInfo: {
    ...IOSTypography.caption1,
    color: IOSColors.tertiaryLabel,
    marginTop: 2,
  },
  streakContainer: {
    backgroundColor: IOSColors.systemBlue + '15', // 15% opacity
    borderRadius: IOSBorderRadius.xl,
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.sm,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOSColors.tertiarySystemFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButtonText: {
    fontSize: 18,
  },
  streakNumber: {
    ...IOSTypography.title2,
    color: IOSColors.systemBlue,
    fontWeight: '700',
  },
  streakLabel: {
    ...IOSTypography.caption2,
    color: IOSColors.systemBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  scrollView: {
    flex: 1,
  },
  bottomSpacing: {
    height: IOSSpacing['2xl'],
  },
});
