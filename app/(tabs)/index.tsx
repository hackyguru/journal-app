import DailyMemory from '@/components/daily-memory';
import { ModernColors, ModernLayoutStyles, ModernSpacing, ModernTypography } from '@/components/ui/modern-design-system';
import WeeklyCalendar from '@/components/weekly-calendar';
import { useAuth } from '@/contexts/AuthContext';
import { usePinecone } from '@/hooks/usePinecone';
import { getCurrentWeekStart, getTodayLocalDate } from '@/utils/dateUtils';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ModernHomeScreen() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDate());
  const [memoryDates, setMemoryDates] = useState<Set<string>>(new Set());
  const [isMemoryExpanded, setIsMemoryExpanded] = useState(false);
  const { user, signOut } = useAuth();
  const { getWeekMemories } = usePinecone();
  const navigation = useNavigation();

  const loadWeekMemories = async () => {
    try {
      // Don't load if user is not authenticated
      if (!user?.id) {
        console.log('No user authenticated, skipping week memories load');
        setMemoryDates(new Set());
        return;
      }

      const weekStart = getCurrentWeekStart();
      console.log('Loading week memories for user:', user.id, 'week start:', weekStart);
      const result = await getWeekMemories(weekStart);
      
      if (result.success) {
        console.log('Week memories result:', JSON.stringify(result, null, 2));
        const dates = new Set<string>();
        Object.entries(result.memories).forEach(([date, day]: [string, any]) => {
          console.log(`Processing date ${date}:`, day.hasMemory ? 'HAS MEMORY' : 'NO MEMORY');
          if (day.hasMemory) {
            dates.add(day.date);
            console.log(`Added date to set: ${day.date}`);
          }
        });
        console.log('Final memory dates:', Array.from(dates));
        setMemoryDates(dates);
      } else {
        console.error('Failed to load week memories:', result.error);
        setMemoryDates(new Set());
      }
    } catch (error) {
      console.error('Error loading week memories:', error);
      setMemoryDates(new Set());
    }
  };

  useEffect(() => {
    loadWeekMemories();
    setSelectedDate(getTodayLocalDate());
  }, [user]);

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

  const handleMemoryExpanded = (isExpanded: boolean) => {
    setIsMemoryExpanded(isExpanded);
  };

  // Control tab bar visibility based on memory expansion
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: isMemoryExpanded 
        ? { display: 'none' } 
        : {
            backgroundColor: '#000000',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          }
    });
  }, [isMemoryExpanded, navigation]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
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

  const getSelectedDateTitle = () => {
    const today = getTodayLocalDate();
    if (selectedDate === today) {
      return 'Today';
    }
    
    const date = new Date(selectedDate + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    
    return `${dayName}, ${monthDay}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={ModernColors.background} />
      
      {/* Header - No Card Background */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}
            </Text>
          </View>
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={styles.menuIcon}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar - Clean Design */}
        <WeeklyCalendar
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
          memoryDates={memoryDates}
        />

        {/* Today Section */}
        <View style={styles.todaySection}>
          <Text style={styles.sectionTitle}>Today</Text>
        </View>
      </ScrollView>

      {/* Daily Memory with Wallet Cards - positioned absolutely at bottom */}
      <DailyMemory 
        selectedDate={selectedDate}
        onMemoryUpdate={handleMemoryUpdate}
        onExpandedChange={handleMemoryExpanded}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...ModernLayoutStyles.container,
  },
  
  // Header - Clean, no card background
  header: {
    paddingHorizontal: ModernSpacing.lg,
    paddingTop: ModernSpacing.md,
    paddingBottom: ModernSpacing.sm,
  },
  
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  
  greeting: {
    ...ModernTypography.title2, // Changed from largeTitle to title2 for smaller size
    color: ModernColors.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  
  menuIcon: {
    ...ModernTypography.title1,
    color: ModernColors.primary,
    fontWeight: '700',
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    paddingBottom: 100, // Space for FAB
  },
  
  // Today Section
  todaySection: {
    paddingHorizontal: ModernSpacing.lg,
    marginBottom: ModernSpacing.xl,
  },
  
  sectionTitle: {
    ...ModernTypography.title3,
    color: ModernColors.primary,
    fontWeight: '700',
    marginBottom: ModernSpacing.md,
  },
});
