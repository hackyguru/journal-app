/**
 * Centralized date utilities to ensure consistent date handling across the application.
 * This prevents timezone issues and date format inconsistencies.
 */

/**
 * Gets the current local date in YYYY-MM-DD format.
 * Uses local timezone, not UTC, to prevent timezone issues.
 */
export const getTodayLocalDate = (): string => {
  const today = new Date();
  return formatDateToYMD(today);
};

/**
 * Formats a Date object to YYYY-MM-DD string using local timezone.
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 */
export const formatDateToYMD = (date: Date): string => {
  return date.getFullYear() + '-' + 
    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
    String(date.getDate()).padStart(2, '0');
};

/**
 * Checks if a date string (YYYY-MM-DD) represents today.
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns True if the date is today
 */
export const isToday = (dateString: string): boolean => {
  return dateString === getTodayLocalDate();
};

/**
 * Checks if a date string represents a past date.
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns True if the date is in the past
 */
export const isPastDate = (dateString: string): boolean => {
  const inputDate = new Date(dateString + 'T00:00:00'); // Ensure local timezone
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);
  
  return inputDate.getTime() < today.getTime();
};

/**
 * Checks if a date string represents a future date.
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns True if the date is in the future
 */
export const isFutureDate = (dateString: string): boolean => {
  const inputDate = new Date(dateString + 'T00:00:00'); // Ensure local timezone
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);
  
  return inputDate.getTime() > today.getTime();
};

/**
 * Gets the start of the current week (Monday) in YYYY-MM-DD format.
 * @returns Monday's date string in YYYY-MM-DD format
 */
export const getCurrentWeekStart = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday);
  return formatDateToYMD(monday);
};

/**
 * Formats a date string for display.
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "Monday, September 25, 2023")
 */
export const formatDateForDisplay = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00'); // Ensure local timezone
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

/**
 * Compares two date strings for equality.
 * @param date1 - First date string in YYYY-MM-DD format
 * @param date2 - Second date string in YYYY-MM-DD format
 * @returns True if dates are equal
 */
export const areDatesEqual = (date1: string, date2: string): boolean => {
  return date1 === date2;
};

/**
 * Gets a date object set to midnight local time from a YYYY-MM-DD string.
 * This prevents timezone issues when working with dates.
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object set to midnight local time
 */
export const getLocalMidnightDate = (dateString: string): Date => {
  const date = new Date(dateString + 'T00:00:00');
  return date;
};

/**
 * Validates if a date string is in the correct YYYY-MM-DD format.
 * @param dateString - Date string to validate
 * @returns True if valid format
 */
export const isValidDateFormat = (dateString: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString + 'T00:00:00');
  return !isNaN(date.getTime()) && formatDateToYMD(date) === dateString;
};
