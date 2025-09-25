import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IOSBorderRadius, IOSCardStyles, IOSColors, IOSShadows, IOSSpacing, IOSTypography } from './ui/ios-design-system';

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
      {/* Header with navigation */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => navigateWeek('prev')}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        
        <View style={styles.centerSection}>
          <Text style={styles.weekText}>{getCurrentWeekText()}</Text>
          <TouchableOpacity 
            style={styles.todayButton}
            onPress={goToToday}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => navigateWeek('next')}
        >
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
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
            <Text style={getWeekdayTextStyle(day)}>{day.weekday}</Text>
            <Text style={getDayTextStyle(day)}>{day.day}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...IOSCardStyles.insetGrouped,
    marginHorizontal: IOSSpacing.md,
    marginVertical: IOSSpacing.sm,
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: IOSSpacing.xl,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  navButton: {
    width: 44, // iOS minimum touch target
    height: 44,
    borderRadius: IOSBorderRadius.full,
    backgroundColor: IOSColors.systemFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 22,
    fontWeight: '600',
    color: IOSColors.systemBlue,
  },
  weekText: {
    ...IOSTypography.headline,
    color: IOSColors.label,
    marginBottom: IOSSpacing.xs,
  },
  todayButton: {
    backgroundColor: IOSColors.systemBlue,
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.xs,
    borderRadius: IOSBorderRadius.md,
  },
  todayButtonText: {
    ...IOSTypography.caption1,
    color: IOSColors.systemBackground,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: IOSSpacing.xs,
  },
  dayContainer: {
    width: (screenWidth - 120) / 7, // More generous calculation for wider containers
    height: 80,
    borderRadius: IOSBorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: IOSColors.tertiarySystemFill,
    position: 'relative',
  },
  todayContainer: {
    backgroundColor: IOSColors.systemBlue + '20', // 20% opacity
    borderColor: IOSColors.systemBlue,
    borderWidth: 1,
  },
  todaySelectedContainer: {
    backgroundColor: IOSColors.systemBlue,
    borderColor: IOSColors.systemBlue,
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
    ...IOSShadows.small,
  },
  selectedContainer: {
    backgroundColor: IOSColors.systemBlue + '15', // 15% opacity
    borderWidth: 1,
    borderColor: IOSColors.systemBlue,
  },
  futureContainer: {
    backgroundColor: IOSColors.quaternarySystemFill,
    opacity: 0.6,
  },
  memoryContainer: {
    backgroundColor: IOSColors.systemGreen + '10', // 10% opacity
    borderWidth: 1,
    borderColor: IOSColors.systemGreen + '40', // 40% opacity
  },
  weekdayText: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    marginBottom: IOSSpacing.xs,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  todayWeekdayText: {
    color: IOSColors.systemBlue,
    fontWeight: '600',
  },
  todaySelectedWeekdayText: {
    color: IOSColors.systemBackground,
    fontWeight: '700',
  },
  selectedWeekdayText: {
    color: IOSColors.systemBlue,
    fontWeight: '600',
  },
  futureWeekdayText: {
    color: IOSColors.tertiaryLabel,
  },
  dayText: {
    ...IOSTypography.headline,
    fontSize: 20,
    fontWeight: '600',
    color: IOSColors.label,
  },
  todayText: {
    color: IOSColors.systemBlue,
    fontWeight: '700',
  },
  todaySelectedText: {
    color: IOSColors.systemBackground,
    fontWeight: '800',
  },
  selectedText: {
    color: IOSColors.systemBlue,
    fontWeight: '700',
  },
  futureText: {
    color: IOSColors.tertiaryLabel,
  },
});

export default WeeklyCalendar;
