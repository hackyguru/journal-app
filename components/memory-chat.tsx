import { useAuth } from '@/contexts/AuthContext';
import { usePinecone } from '@/hooks/usePinecone';
import { getTodayLocalDate } from '@/utils/dateUtils';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { IOSBorderRadius, IOSColors, IOSSpacing, IOSTypography } from './ui/ios-design-system';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  memoriesUsed?: number;
}

type DateRangePreset = 'all' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

const MemoryChat: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      type: 'assistant',
      content: "Hi! I'm your personal memory assistant. Ask me questions about your stored memories, like 'What's my favorite fruit?' or 'Tell me about programming languages I've learned about.' You can also filter by date range using the options above.",
      timestamp: new Date(),
    }
  ]);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const { user } = useAuth();
  const { askQuestion, isLoading, error } = usePinecone();

  const getDateRange = (): { startDate?: string; endDate?: string } => {
    const today = getTodayLocalDate();
    const todayDate = new Date(today);
    
    switch (dateRangePreset) {
      case 'last7':
        const last7Days = new Date(todayDate);
        last7Days.setDate(todayDate.getDate() - 7);
        return { startDate: last7Days.toISOString().split('T')[0], endDate: today };
      
      case 'last30':
        const last30Days = new Date(todayDate);
        last30Days.setDate(todayDate.getDate() - 30);
        return { startDate: last30Days.toISOString().split('T')[0], endDate: today };
      
      case 'thisMonth':
        const thisMonthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
        return { startDate: thisMonthStart.toISOString().split('T')[0], endDate: today };
      
      case 'lastMonth':
        const lastMonthStart = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
        const lastMonthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
        return { 
          startDate: lastMonthStart.toISOString().split('T')[0], 
          endDate: lastMonthEnd.toISOString().split('T')[0] 
        };
      
      case 'custom':
        return { 
          startDate: customStartDate || undefined, 
          endDate: customEndDate || undefined 
        };
      
      case 'all':
      default:
        return {};
    }
  };

  const getDateRangeLabel = (): string => {
    switch (dateRangePreset) {
      case 'last7': return 'Last 7 days';
      case 'last30': return 'Last 30 days';
      case 'thisMonth': return 'This month';
      case 'lastMonth': return 'Last month';
      case 'custom': 
        if (customStartDate && customEndDate) {
          return `${customStartDate} to ${customEndDate}`;
        } else if (customStartDate) {
          return `From ${customStartDate}`;
        } else if (customEndDate) {
          return `Until ${customEndDate}`;
        }
        return 'Custom range';
      case 'all':
      default:
        return 'All memories';
    }
  };

  const handleSendQuestion = async () => {
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentQuestion = question.trim();
    setQuestion('');

    try {
      const dateRange = getDateRange();
      const result = await askQuestion(currentQuestion, 5, dateRange);
      
      if (result.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: result.answer || 'I apologize, but I couldn\'t generate a response.',
          timestamp: new Date(),
          memoriesUsed: result.memoriesUsed,
        };

        setMessages(prev => [...prev, assistantMessage]);

        if (result.fallback) {
          Alert.alert(
            'Limited Context', 
            'I couldn\'t access your specific memories for this question, so I provided a general response.'
          );
        }
      } else {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `I'm sorry, I encountered an error: ${result.error}`,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'I apologize, but I encountered an unexpected error while processing your question.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <View style={styles.container}>
      {/* Date Range Selector */}
      <View style={styles.dateRangeContainer}>
        <Text style={styles.dateRangeLabel}>Search in: {getDateRangeLabel()}</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.dateRangeOptions}
          contentContainerStyle={styles.dateRangeOptionsContent}
        >
          {[
            { key: 'all', label: 'All' },
            { key: 'last7', label: 'Last 7 days' },
            { key: 'last30', label: 'Last 30 days' },
            { key: 'thisMonth', label: 'This month' },
            { key: 'lastMonth', label: 'Last month' },
          ].map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.dateRangeOption,
                dateRangePreset === option.key && styles.dateRangeOptionActive
              ]}
              onPress={() => setDateRangePreset(option.key as DateRangePreset)}
            >
              <Text style={[
                styles.dateRangeOptionText,
                dateRangePreset === option.key && styles.dateRangeOptionTextActive
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView 
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💭</Text>
            <Text style={styles.emptyTitle}>Ask About Your Memories</Text>
            <Text style={styles.emptySubtitle}>
              What would you like to know about your past experiences?
            </Text>
          </View>
        ) : (
          messages.map((message) => (
            <View key={message.id} style={styles.messageRow}>
              <View style={[
                styles.messageBubble,
                message.type === 'user' ? styles.userBubble : styles.assistantBubble
              ]}>
                <Text style={[
                  styles.messageText,
                  message.type === 'user' ? styles.userText : styles.assistantText
                ]}>
                  {message.content}
                </Text>
                {message.memoriesUsed !== undefined && message.memoriesUsed > 0 && (
                  <Text style={styles.memoryHint}>
                    {message.memoriesUsed} memor{message.memoriesUsed === 1 ? 'y' : 'ies'} found
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.inputSection}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask about your memories..."
            placeholderTextColor={IOSColors.tertiaryLabel}
            value={question}
            onChangeText={setQuestion}
            multiline={false}
            maxLength={200}
            editable={!isLoading}
            returnKeyType="send"
            onSubmitEditing={handleSendQuestion}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!question.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSendQuestion}
            disabled={!question.trim() || isLoading}
          >
            <Text style={styles.sendButtonText}>
              {isLoading ? '⏳' : '↗'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOSColors.systemGroupedBackground,
  },
  
  dateRangeContainer: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: IOSColors.separator,
  },
  
  dateRangeLabel: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    marginBottom: IOSSpacing.xs,
    fontWeight: '600',
  },
  
  dateRangeOptions: {
    flexGrow: 0,
  },
  
  dateRangeOptionsContent: {
    paddingRight: IOSSpacing.md,
  },
  
  dateRangeOption: {
    paddingHorizontal: IOSSpacing.sm,
    paddingVertical: IOSSpacing.xs,
    backgroundColor: IOSColors.tertiarySystemGroupedBackground,
    borderRadius: IOSBorderRadius.sm,
    marginRight: IOSSpacing.xs,
    borderWidth: 1,
    borderColor: IOSColors.separator,
  },
  
  dateRangeOptionActive: {
    backgroundColor: IOSColors.systemBlue,
    borderColor: IOSColors.systemBlue,
  },
  
  dateRangeOptionText: {
    ...IOSTypography.caption1,
    color: IOSColors.label,
    fontWeight: '500',
  },
  
  dateRangeOptionTextActive: {
    color: IOSColors.systemBackground,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: IOSSpacing.md,
  },
  messagesContent: {
    paddingTop: IOSSpacing.lg,
    paddingBottom: IOSSpacing.xl,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: IOSSpacing.xl,
    minHeight: 300,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: IOSSpacing.lg,
  },
  emptyTitle: {
    ...IOSTypography.title2,
    color: IOSColors.label,
    marginBottom: IOSSpacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Messages
  messageRow: {
    marginBottom: IOSSpacing.md,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: IOSSpacing.md,
    borderRadius: IOSBorderRadius.xl,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: IOSColors.systemBlue,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: IOSColors.systemBackground,
    borderWidth: 1,
    borderColor: IOSColors.separator,
  },
  messageText: {
    ...IOSTypography.callout,
    fontSize: 13,
    lineHeight: 18,
  },
  userText: {
    color: IOSColors.systemBackground,
  },
  assistantText: {
    color: IOSColors.label,
  },
  memoryHint: {
    ...IOSTypography.caption2,
    color: IOSColors.systemBlue,
    marginTop: IOSSpacing.xs,
    opacity: 0.8,
    fontSize: 11,
  },
  // Input Section  
  inputSection: {
    backgroundColor: IOSColors.systemBackground,
    paddingHorizontal: IOSSpacing.md,
    paddingTop: IOSSpacing.md,
    paddingBottom: IOSSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: IOSBorderRadius.full,
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.sm,
  },
  textInput: {
    flex: 1,
    ...IOSTypography.callout,
    color: IOSColors.label,
    paddingVertical: IOSSpacing.xs,
    fontSize: 13,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOSColors.systemBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: IOSSpacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: IOSColors.systemGray3,
  },
  sendButtonText: {
    fontSize: 16,
    color: IOSColors.systemBackground,
    fontWeight: '600',
  },
  errorContainer: {
    marginTop: IOSSpacing.sm,
  },
  errorText: {
    ...IOSTypography.caption1,
    color: IOSColors.systemRed,
    textAlign: 'center',
  },
});

export default MemoryChat;
