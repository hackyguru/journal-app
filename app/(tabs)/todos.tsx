import { IOSCardStyles, IOSColors, IOSSpacing, IOSTypography } from '@/components/ui/ios-design-system';
import { useAuth } from '@/contexts/AuthContext';
import { useTodos } from '@/hooks/useTodos';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  category: string;
  sourceMemoryId?: string;
  sourceMemoryDate?: string;
  sourceMemoryText?: string;
  createdAt: string;
  completedAt?: string;
}

export default function TodosScreen() {
  const { user } = useAuth();
  const { todos, isLoading, error, refreshTodos, toggleTodoComplete, extractTodosFromMemories } = useTodos();
  const [isExtracting, setIsExtracting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      refreshTodos();
    }
  }, [user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshTodos();
    setRefreshing(false);
  };

  const handleExtractTodos = async () => {
    if (!user?.id) return;
    
    setIsExtracting(true);
    try {
      const result = await extractTodosFromMemories();
      if (result.success) {
        Alert.alert(
          'Success', 
          `Extracted ${result.newTodosCount} new action items from your memories!`,
          [{ text: 'OK', onPress: () => refreshTodos() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to extract todos');
      }
    } catch (error) {
      console.error('Error extracting todos:', error);
      Alert.alert('Error', 'Failed to extract todos from memories');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleToggleComplete = async (todoId: string, completed: boolean) => {
    try {
      await toggleTodoComplete(todoId, !completed);
      await refreshTodos(); // Refresh to get updated list
    } catch (error) {
      console.error('Error toggling todo:', error);
      Alert.alert('Error', 'Failed to update todo');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return IOSColors.systemRed;
      case 'medium': return IOSColors.systemOrange;
      case 'low': return IOSColors.systemGreen;
      default: return IOSColors.systemGray;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const renderTodoItem = (todo: TodoItem) => (
    <View key={todo.id} style={styles.todoCard}>
      <TouchableOpacity 
        style={styles.todoContent}
        onPress={() => handleToggleComplete(todo.id, todo.completed)}
      >
        <View style={styles.todoHeader}>
          <View style={styles.todoLeft}>
            <Text style={styles.checkboxIcon}>
              {todo.completed ? '✅' : '⬜'}
            </Text>
            <View style={styles.todoInfo}>
              <Text style={[
                styles.todoTitle,
                todo.completed && styles.completedText
              ]}>
                {todo.title}
              </Text>
              {todo.category && (
                <Text style={styles.todoCategory}>#{todo.category}</Text>
              )}
            </View>
          </View>
          <View style={styles.todoRight}>
            <Text style={styles.priorityIcon}>
              {getPriorityIcon(todo.priority)}
            </Text>
          </View>
        </View>
        
        {todo.sourceMemoryDate && (
          <View style={styles.sourceInfo}>
            <Text style={styles.sourceText}>
              From memory on {new Date(todo.sourceMemoryDate).toLocaleDateString()}
            </Text>
            {todo.sourceMemoryText && (
              <Text style={styles.sourceMemoryText} numberOfLines={2}>
                "{todo.sourceMemoryText}"
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const completedTodos = todos.filter(todo => todo.completed);
  const pendingTodos = todos.filter(todo => !todo.completed);

  if (!user?.id) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Please sign in to view your tasks</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Action Items</Text>
          <Text style={styles.headerSubtitle}>
            {pendingTodos.length} pending • {completedTodos.length} completed
          </Text>
        </View>

        {/* Extract Button */}
        <TouchableOpacity 
          style={[styles.extractButton, (isExtracting || isLoading) && styles.disabledButton]}
          onPress={handleExtractTodos}
          disabled={isExtracting || isLoading}
        >
          {isExtracting ? (
            <ActivityIndicator size="small" color={IOSColors.systemBackground} />
          ) : (
            <Text style={styles.extractButtonIcon}>🤖</Text>
          )}
          <Text style={styles.extractButtonText}>
            {isExtracting ? 'Extracting...' : 'Extract from Memories'}
          </Text>
        </TouchableOpacity>

        {/* Loading State */}
        {isLoading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={IOSColors.systemBlue} />
            <Text style={styles.loadingText}>Loading your tasks...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Pending Todos */}
        {!isLoading && pendingTodos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending ({pendingTodos.length})</Text>
            {pendingTodos.map(renderTodoItem)}
          </View>
        )}

        {/* Completed Todos */}
        {!isLoading && completedTodos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed ({completedTodos.length})</Text>
            {completedTodos.map(renderTodoItem)}
          </View>
        )}

        {/* Empty State */}
        {!isLoading && todos.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📝</Text>
            <Text style={styles.emptyStateTitle}>No Action Items Yet</Text>
            <Text style={styles.emptyStateText}>
              Tap "Extract from Memories" to find actionable items from your memories, 
              or add some memories first!
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOSColors.systemGroupedBackground,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: IOSSpacing.lg,
    paddingTop: IOSSpacing.lg,
    paddingBottom: IOSSpacing.md,
  },
  headerTitle: {
    ...IOSTypography.largeTitle,
    fontWeight: '700',
    color: IOSColors.label,
  },
  headerSubtitle: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
  },
  extractButton: {
    ...IOSCardStyles.insetGrouped,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOSColors.systemBlue,
    paddingVertical: IOSSpacing.md,
    marginBottom: IOSSpacing.lg,
  },
  disabledButton: {
    opacity: 0.6,
  },
  extractButtonIcon: {
    fontSize: 20,
    marginRight: IOSSpacing.sm,
  },
  extractButtonText: {
    ...IOSTypography.callout,
    color: IOSColors.systemBackground,
    fontWeight: '600',
  },
  section: {
    marginBottom: IOSSpacing.lg,
  },
  sectionTitle: {
    ...IOSTypography.title3,
    fontWeight: '600',
    color: IOSColors.label,
    paddingHorizontal: IOSSpacing.lg,
    marginBottom: IOSSpacing.sm,
  },
  todoCard: {
    ...IOSCardStyles.insetGrouped,
    marginBottom: IOSSpacing.sm,
  },
  todoContent: {
    padding: IOSSpacing.md,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  todoLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxIcon: {
    fontSize: 20,
    marginRight: IOSSpacing.sm,
    marginTop: 2,
  },
  todoInfo: {
    flex: 1,
  },
  todoTitle: {
    ...IOSTypography.body,
    color: IOSColors.label,
    fontWeight: '500',
    lineHeight: 22,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: IOSColors.secondaryLabel,
  },
  todoCategory: {
    ...IOSTypography.caption1,
    color: IOSColors.systemBlue,
    marginTop: 2,
    fontWeight: '500',
  },
  todoRight: {
    marginLeft: IOSSpacing.sm,
  },
  priorityIcon: {
    fontSize: 16,
  },
  sourceInfo: {
    marginTop: IOSSpacing.sm,
    paddingTop: IOSSpacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: IOSColors.separator,
  },
  sourceText: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    fontWeight: '500',
  },
  sourceMemoryText: {
    ...IOSTypography.caption2,
    color: IOSColors.tertiaryLabel,
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: IOSSpacing.xl,
  },
  loadingText: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    marginTop: IOSSpacing.sm,
  },
  errorContainer: {
    ...IOSCardStyles.insetGrouped,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOSColors.systemRed + '10',
    paddingVertical: IOSSpacing.md,
    marginBottom: IOSSpacing.lg,
  },
  errorIcon: {
    fontSize: 20,
    marginRight: IOSSpacing.sm,
  },
  errorText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemRed,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: IOSSpacing['2xl'],
    paddingHorizontal: IOSSpacing.lg,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: IOSSpacing.md,
  },
  emptyStateTitle: {
    ...IOSTypography.title2,
    fontWeight: '600',
    color: IOSColors.label,
    marginBottom: IOSSpacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  bottomSpacing: {
    height: IOSSpacing['2xl'],
  },
});
