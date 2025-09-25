import DailyMemory from '@/components/daily-memory';
import { IOSBorderRadius, IOSColors, IOSLayoutStyles, IOSSpacing, IOSTypography, useIOSSafeAreaStyles } from '@/components/ui/ios-design-system';
import WeeklyCalendar from '@/components/weekly-calendar';
import { usePinecone } from '@/hooks/usePinecone';
import React, { useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  // Fix timezone issue - use local date instead of UTC
  const getTodayLocalDate = () => {
    const today = new Date();
    return today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0');
  };
  
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDate());
  const [memoryDates, setMemoryDates] = useState<Set<string>>(new Set());
  const { getWeekMemories } = usePinecone();
  const safeAreaStyles = useIOSSafeAreaStyles();

  const getCurrentWeekStart = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + daysToMonday);
    return monday.toISOString().split('T')[0];
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={IOSColors.systemGroupedBackground} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.status}>{getTodayStatus()}</Text>
        </View>
        <View style={styles.streakContainer}>
          <Text style={styles.streakNumber}>{memoryDates.size}</Text>
          <Text style={styles.streakLabel}>memories</Text>
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
  greeting: {
    ...IOSTypography.largeTitle,
    marginBottom: 2,
  },
  status: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
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
