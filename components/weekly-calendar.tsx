import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ModernColors, ModernSpacing, ModernTypography } from './ui/modern-design-system';

const { width: screenWidth } = Dimensions.get('window');

interface WeeklyCalendarProps {
  onDateSelect: (date: string) => void;
  selectedDate: string;
  memoryDates: Set<string>;
}

interface DayData {
  date: string;
  day: number;
  weekday: string;
  isToday: boolean;
  hasMemory: boolean;
  isPast: boolean;
  isFuture: boolean;
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  onDateSelect,
  selectedDate,
  memoryDates
}) => {
  const [currentWeek, setCurrentWeek] = useState<DayData[]>([]);
  
  // Initialize with the start of the current week (Monday)
  const getCurrentWeekStart = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + daysToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };
  
  const [weekStart, setWeekStart] = useState<Date>(getCurrentWeekStart());

  const generateWeekDays = (startDate: Date): DayData[] => {
    const days: DayData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from Monday
    const monday = new Date(startDate);
    const dayOfWeek = monday.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(monday.getDate() + daysToMonday);

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + i);
      // Fix timezone issue - use local date instead of UTC
      const dateStr = currentDate.getFullYear() + '-' + 
        String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
        String(currentDate.getDate()).padStart(2, '0');
      
      const isToday = currentDate.getTime() === today.getTime();
      
      days.push({
        date: dateStr,
        day: currentDate.getDate(),
        weekday: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday,
        hasMemory: memoryDates.has(dateStr),
        isPast: currentDate.getTime() < today.getTime(),
        isFuture: currentDate.getTime() > today.getTime(),
      });
    }

    return days;
  };

  useEffect(() => {
    const days = generateWeekDays(weekStart);
    setCurrentWeek(days);
  }, [weekStart, memoryDates]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(weekStart);
    newWeekStart.setDate(weekStart.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStart(newWeekStart);
  };

  const goToToday = () => {
    const todayWeekStart = getCurrentWeekStart();
    setWeekStart(todayWeekStart);
    
    // Also select today's date - fix timezone issue
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0');
    onDateSelect(todayStr);
  };

  const getCurrentWeekText = () => {
    const endDate = new Date(weekStart);
    endDate.setDate(weekStart.getDate() + 6);
    
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    
    if (startMonth === endMonth) {
      return `${startMonth} ${weekStart.getDate()}-${endDate.getDate()}`;
    } else {
      return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${endDate.getDate()}`;
    }
  };

  const getDayStyle = (day: DayData) => {
    const baseStyle = [styles.dayContainer];
    
    // Priority: Today + Selected > Today > Selected > Future > Default
    if (day.isToday && day.date === selectedDate) {
      baseStyle.push(styles.todaySelectedContainer);
    } else if (day.isToday) {
      baseStyle.push(styles.todayContainer);
    } else if (day.date === selectedDate) {
      baseStyle.push(styles.selectedContainer);
    } else if (day.isFuture) {
      baseStyle.push(styles.futureContainer);
    }
    
    if (day.hasMemory && !day.isToday) {
      baseStyle.push(styles.memoryContainer);
    }
    
    return baseStyle;
  };

  const getDayTextStyle = (day: DayData) => {
    const baseStyle = [styles.dayText];
    
    if (day.isToday && day.date === selectedDate) {
      baseStyle.push(styles.todaySelectedText);
    } else if (day.isToday) {
      baseStyle.push(styles.todayText);
    } else if (day.date === selectedDate) {
      baseStyle.push(styles.selectedText);
    } else if (day.isFuture) {
      baseStyle.push(styles.futureText);
    }
    
    return baseStyle;
  };

  const getWeekdayTextStyle = (day: DayData) => {
    const baseStyle = [styles.weekdayText];
    
    if (day.isToday && day.date === selectedDate) {
      baseStyle.push(styles.todaySelectedWeekdayText);
    } else if (day.isToday) {
      baseStyle.push(styles.todayWeekdayText);
    } else if (day.date === selectedDate) {
      baseStyle.push(styles.selectedWeekdayText);
    } else if (day.isFuture) {
      baseStyle.push(styles.futureWeekdayText);
    }
    
    return baseStyle;
  };

  return (
    <View style={styles.container}>
      {/* Day Headers */}
      <View style={styles.dayHeadersContainer}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayLetter, index) => (
          <Text key={`header-${index}`} style={styles.dayHeader}>{dayLetter}</Text>
        ))}
      </View>
      
      {/* Days of the week */}
      <View style={styles.daysContainer}>
        {currentWeek.map((day) => (
          <TouchableOpacity
            key={day.date}
            style={getDayStyle(day)}
            onPress={() => onDateSelect(day.date)}
            disabled={day.isFuture}
          >
            <Text style={getDayTextStyle(day)}>{day.day}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: ModernSpacing.lg,
    paddingVertical: ModernSpacing.md,
  },
  
  dayHeadersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: ModernSpacing.xs,
    marginBottom: ModernSpacing.sm,
  },
  
  dayHeader: {
    ...ModernTypography.caption1,
    color: ModernColors.secondary,
    fontWeight: '500',
    textAlign: 'center',
    width: (screenWidth - 120) / 7,
  },
  // Removed unused navigation styles for clean design
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: ModernSpacing.xs,
  },
  dayContainer: {
    width: (screenWidth - 120) / 7,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  todayContainer: {
    backgroundColor: ModernColors.secondaryBackground,
  },
  todaySelectedContainer: {
    backgroundColor: ModernColors.primary, // Black background like in reference
  },
  selectedContainer: {
    backgroundColor: ModernColors.primary, // Black background like in reference
  },
  futureContainer: {
    backgroundColor: ModernColors.secondaryBackground,
    opacity: 0.6,
  },
  memoryContainer: {
    backgroundColor: ModernColors.success + '10', // 10% opacity
    borderWidth: 1,
    borderColor: ModernColors.success + '40', // 40% opacity
  },
  
  // Text Styles
  dayText: {
    ...ModernTypography.headline,
    fontWeight: '600',
    fontSize: 18,
    color: ModernColors.primary,
  },
  selectedText: {
    color: ModernColors.cardBackground, // White text on black background
  },
  todayText: {
    color: ModernColors.primary,
  },
  todaySelectedText: {
    color: ModernColors.cardBackground, // White text on black background
  },
  futureText: {
    color: ModernColors.tertiary,
  },
  // Removed unused weekday text styles - we only show day numbers now
  // Duplicate text styles removed - using the ones defined above
});

export default WeeklyCalendar;
