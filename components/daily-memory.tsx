import { usePinecone } from '@/hooks/usePinecone';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ConversationalAssistant from './conversational-assistant';
import { IOSBorderRadius, IOSButtonStyles, IOSButtonTextStyles, IOSCardStyles, IOSColors, IOSSpacing, IOSTypography } from './ui/ios-design-system';

interface DailyMemoryProps {
  selectedDate: string;
  onMemoryUpdate: (hasMemory: boolean) => void;
}

const DailyMemory: React.FC<DailyMemoryProps> = ({ selectedDate, onMemoryUpdate }) => {
  const [memoryText, setMemoryText] = useState('');
  const [existingMemory, setExistingMemory] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputMethod, setInputMethod] = useState<'text' | 'voice' | 'conversation'>('text');
  const [showConversationalAssistant, setShowConversationalAssistant] = useState(false);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const { upsertData, isLoading, error } = usePinecone();

  const isToday = () => {
    // Fix timezone issue - use local date instead of UTC
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0');
    
    return selectedDate === todayStr;
  };

  const formatDate = () => {
    const date = new Date(selectedDate);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleSaveMemory = async () => {
    if (!memoryText.trim()) {
      Alert.alert('Empty Memory', 'Please write something for your memory.');
      return;
    }

    if (!isToday()) {
      Alert.alert('Invalid Date', 'You can only create memories for today.');
      return;
    }

    try {
      const result = await upsertData(memoryText.trim(), { date: selectedDate });
      
      if (result.success) {
        Alert.alert('Success', 'Your memory has been saved!');
        setExistingMemory({ text: memoryText.trim(), date: selectedDate });
        setIsEditing(false);
        onMemoryUpdate(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to save memory');
      }
    } catch (err) {
      console.error('Error saving memory:', err);
      Alert.alert('Error', 'Failed to save memory');
    }
  };

  const handleEditMemory = () => {
    if (!isToday()) {
      Alert.alert('Cannot Edit', 'You can only edit today\'s memory.');
      return;
    }
    setIsEditing(true);
    setMemoryText(existingMemory?.text || '');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setMemoryText('');
    setInputMethod('text');
  };

  const handleConversationalMemoryComplete = async (memoryText: string) => {
    setMemoryText(memoryText);
    setShowConversationalAssistant(false);
    
    // Automatically save the memory from the conversation
    try {
      const result = await upsertData(memoryText.trim(), { date: selectedDate });
      
      if (result.success) {
        Alert.alert('Memory Saved!', 'Your conversational memory has been saved successfully.');
        setExistingMemory({ text: memoryText.trim(), date: selectedDate });
        setIsEditing(false);
        onMemoryUpdate(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to save memory');
      }
    } catch (err) {
      console.error('Error saving conversational memory:', err);
      Alert.alert('Error', 'Failed to save memory');
    }
  };

  const handleCloseConversationalAssistant = () => {
    setShowConversationalAssistant(false);
    setIsEditing(false);
  };

  const toggleInputMethod = () => {
    setInputMethod(prev => prev === 'text' ? 'voice' : 'text');
  };

  // Function to load existing memory for a specific date
  const loadExistingMemory = async (date: string) => {
    setIsLoadingMemory(true);
    try {
      // Use the same approach as the week endpoint - get all memories with metadata
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // Create a single-day week request to get the memory for this specific date
      const response = await fetch(`${backendUrl}/api/memories/week?startDate=${date}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.memories && result.memories[date]) {
          const dayMemory = result.memories[date];
          if (dayMemory.hasMemory && dayMemory.memory) {
            setExistingMemory({
              text: dayMemory.memory.text,
              date: date,
              id: dayMemory.memory.id
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading existing memory:', error);
    } finally {
      setIsLoadingMemory(false);
    }
  };

  // Load existing memory for selected date
  useEffect(() => {
    // Reset state when date changes
    setExistingMemory(null);
    setMemoryText('');
    setIsEditing(false);
    setShowConversationalAssistant(false);

    // Load existing memory for the selected date
    loadExistingMemory(selectedDate);
  }, [selectedDate]);

  const renderEmptyState = () => {
    if (!isToday()) {
      // Clean message for non-today dates
      return (
        <View style={styles.pastDateContainer}>
          <View style={styles.pastDateContent}>
            <View style={styles.pastDateIconContainer}>
              <Text style={styles.pastDateIcon}>📖</Text>
            </View>
            <Text style={styles.pastDateTitle}>View Only</Text>
            <Text style={styles.pastDateSubtitle}>
              No memory was captured on {formatDate()}
            </Text>
          </View>
        </View>
      );
    }

    // Compact memory creation for today
    return (
      <View style={styles.todayEmptyState}>
        <View style={styles.compactHeader}>
          <Text style={styles.compactTitle}>Capture Today</Text>
          <Text style={styles.compactSubtitle}>How are you feeling?</Text>
        </View>
        
        <View style={styles.compactOptions}>
          <TouchableOpacity 
            style={styles.compactOption}
            onPress={() => {
              setInputMethod('text');
              setIsEditing(true);
            }}
          >
            <Text style={styles.compactOptionIcon}>✍️</Text>
            <Text style={styles.compactOptionText}>Write</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.compactOption}
            onPress={() => {
              setInputMethod('voice');
              setIsEditing(true);
            }}
          >
            <Text style={styles.compactOptionIcon}>🎤</Text>
            <Text style={styles.compactOptionText}>Record</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderExistingMemory = () => (
    <View style={styles.memoryDisplayContainer}>
      <View style={styles.memoryDisplayHeader}>
        <View style={styles.memoryStatusContainer}>
          <View style={styles.memoryStatusDot} />
          <Text style={styles.memoryStatusText}>Memory Saved</Text>
        </View>
        {isToday() && (
          <TouchableOpacity 
            style={styles.editMemoryButton}
            onPress={handleEditMemory}
          >
            <Text style={styles.editMemoryButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.memoryDisplayContent}>
        <Text style={styles.memoryDisplayDate}>{formatDate()}</Text>
        <View style={styles.memoryTextContainer}>
          <Text style={styles.memoryDisplayText}>{existingMemory.text}</Text>
        </View>
      </View>
    </View>
  );

  const renderEditor = () => (
    <View style={styles.editorContainer}>
      <Text style={styles.editorTitle}>
        {existingMemory ? 'Edit your memory' : 'Write your memory'}
      </Text>
      <Text style={styles.editorSubtitle}>{formatDate()}</Text>
      
      {/* Input Method Toggle */}
      <View style={styles.inputMethodToggle}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            inputMethod === 'text' && styles.activeToggleButton
          ]}
          onPress={() => setInputMethod('text')}
        >
          <Text style={[
            styles.toggleButtonText,
            inputMethod === 'text' && styles.activeToggleButtonText
          ]}>
            ✏️ Text
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.toggleButton,
            inputMethod === 'voice' && styles.activeToggleButton
          ]}
          onPress={() => setInputMethod('voice')}
        >
          <Text style={[
            styles.toggleButtonText,
            inputMethod === 'voice' && styles.activeToggleButtonText
          ]}>
            🎤 Voice
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Input Area */}
      {inputMethod === 'text' ? (
        <>
          <TextInput
            style={styles.textInput}
            placeholder="What happened today? How are you feeling? What did you learn?"
            placeholderTextColor={IOSColors.tertiaryLabel}
            value={memoryText}
            onChangeText={setMemoryText}
            multiline
            textAlignVertical="top"
            maxLength={1000}
          />
          
          <View style={styles.characterCount}>
            <Text style={styles.characterCountText}>
              {memoryText.length}/1000 characters
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.voiceInputContainer}>
          <VoiceRecorder
            onTranscriptionComplete={handleVoiceTranscription}
            onError={handleVoiceError}
            disabled={isLoading}
          />
          {memoryText.length > 0 && (
            <View style={styles.transcriptionPreview}>
              <Text style={styles.transcriptionLabel}>Transcribed text:</Text>
              <Text style={styles.transcriptionText}>{memoryText}</Text>
            </View>
          )}
        </View>
      )}
      
      <View style={styles.editorActions}>
        <TouchableOpacity 
          style={[IOSButtonStyles.secondary, styles.actionButton]}
          onPress={handleCancelEdit}
        >
          <Text style={IOSButtonTextStyles.secondary}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[IOSButtonStyles.primary, styles.actionButton, isLoading && styles.disabledButton]}
          onPress={handleSaveMemory}
          disabled={isLoading || memoryText.length === 0}
        >
          <Text style={IOSButtonTextStyles.primary}>
            {isLoading ? 'Saving...' : 'Save Memory'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (showConversationalAssistant) {
    return (
      <ConversationalAssistant
        selectedDate={selectedDate}
        onMemoryComplete={handleConversationalMemoryComplete}
        onClose={handleCloseConversationalAssistant}
      />
    );
  }

  return (
    <View style={styles.container}>      
      {isLoadingMemory ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner}>
            <Text style={styles.loadingIcon}>⏳</Text>
          </View>
          <Text style={styles.loadingText}>Loading memory...</Text>
        </View>
      ) : isEditing 
        ? renderEditor()
        : existingMemory 
          ? renderExistingMemory()
          : renderEmptyState()
      }
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: IOSSpacing.md,
  },
  
  // Past Date Styles
  pastDateContainer: {
    ...IOSCardStyles.insetGrouped,
    paddingVertical: IOSSpacing['2xl'],
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  pastDateContent: {
    alignItems: 'center',
  },
  pastDateIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: IOSColors.systemGray5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IOSSpacing.lg,
  },
  pastDateIcon: {
    fontSize: 28,
  },
  pastDateTitle: {
    ...IOSTypography.title3,
    color: IOSColors.secondaryLabel,
    marginBottom: IOSSpacing.xs,
  },
  pastDateSubtitle: {
    ...IOSTypography.subhead,
    color: IOSColors.tertiaryLabel,
    textAlign: 'center',
    maxWidth: 280,
  },
  
  // Today Empty State Styles - Compact Version
  todayEmptyState: {
    ...IOSCardStyles.insetGrouped,
    paddingVertical: IOSSpacing.lg,
    backgroundColor: IOSColors.systemBackground,
  },
  compactHeader: {
    alignItems: 'center',
    marginBottom: IOSSpacing.lg,
  },
  compactTitle: {
    ...IOSTypography.title2,
    color: IOSColors.label,
    marginBottom: IOSSpacing.xs,
  },
  compactSubtitle: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
  },
  
  // Compact Creation Options
  compactOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: IOSSpacing.lg,
    paddingHorizontal: IOSSpacing.md,
  },
  compactOption: {
    alignItems: 'center',
    padding: IOSSpacing.lg,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: IOSBorderRadius.xl,
    minWidth: 100,
    flex: 1,
    maxWidth: 140,
  },
  compactOptionIcon: {
    fontSize: 28,
    marginBottom: IOSSpacing.xs,
  },
  compactOptionText: {
    ...IOSTypography.subhead,
    color: IOSColors.label,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Memory Display Styles
  memoryDisplayContainer: {
    ...IOSCardStyles.insetGrouped,
    backgroundColor: IOSColors.systemBackground,
  },
  memoryDisplayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: IOSSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
    marginBottom: IOSSpacing.lg,
  },
  memoryStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memoryStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOSColors.systemGreen,
    marginRight: IOSSpacing.xs,
  },
  memoryStatusText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemGreen,
    fontWeight: '600',
  },
  editMemoryButton: {
    paddingVertical: IOSSpacing.sm,
    paddingHorizontal: IOSSpacing.md,
    backgroundColor: IOSColors.systemBlue + '15',
    borderRadius: IOSBorderRadius.md,
  },
  editMemoryButtonText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemBlue,
    fontWeight: '600',
  },
  memoryDisplayContent: {
    gap: IOSSpacing.md,
  },
  memoryDisplayDate: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  memoryTextContainer: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    padding: IOSSpacing.lg,
    borderRadius: IOSBorderRadius.lg,
  },
  memoryDisplayText: {
    ...IOSTypography.body,
    color: IOSColors.label,
    lineHeight: 26,
  },
  editorContainer: {
    ...IOSCardStyles.insetGrouped,
  },
  editorTitle: {
    ...IOSTypography.title2,
    marginBottom: IOSSpacing.sm,
    color: IOSColors.label,
  },
  editorSubtitle: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    marginBottom: IOSSpacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    ...IOSTypography.body,
    backgroundColor: IOSColors.tertiarySystemFill,
    borderRadius: IOSBorderRadius.lg,
    padding: IOSSpacing.md,
    minHeight: 120,
    borderWidth: 1,
    borderColor: IOSColors.separator,
    marginBottom: IOSSpacing.sm,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginBottom: IOSSpacing.lg,
  },
  characterCountText: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: IOSSpacing.md,
  },
  actionButton: {
    flex: 1,
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorContainer: {
    marginTop: IOSSpacing.md,
    padding: IOSSpacing.md,
    backgroundColor: IOSColors.systemRed + '10', // 10% opacity
    borderRadius: IOSBorderRadius.md,
    borderWidth: 1,
    borderColor: IOSColors.systemRed + '30', // 30% opacity
  },
  errorText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemRed,
    textAlign: 'center',
  },
  inputMethodToggle: {
    flexDirection: 'row',
    backgroundColor: IOSColors.tertiarySystemFill,
    borderRadius: IOSBorderRadius.lg,
    padding: 4,
    marginBottom: IOSSpacing.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: IOSSpacing.sm,
    paddingHorizontal: IOSSpacing.md,
    borderRadius: IOSBorderRadius.md,
    alignItems: 'center',
  },
  activeToggleButton: {
    backgroundColor: IOSColors.systemBackground,
    shadowColor: IOSColors.label,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleButtonText: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    fontWeight: '500',
  },
  activeToggleButtonText: {
    color: IOSColors.label,
    fontWeight: '600',
  },
  voiceInputContainer: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: IOSBorderRadius.lg,
    padding: IOSSpacing.lg,
    marginBottom: IOSSpacing.md,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptionPreview: {
    marginTop: IOSSpacing.lg,
    padding: IOSSpacing.md,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: IOSBorderRadius.md,
    borderWidth: 1,
    borderColor: IOSColors.separator,
    width: '100%',
  },
  transcriptionLabel: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    marginBottom: IOSSpacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptionText: {
    ...IOSTypography.body,
    lineHeight: 22,
  },
  // Loading Styles
  loadingContainer: {
    ...IOSCardStyles.insetGrouped,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: IOSSpacing['2xl'],
    minHeight: 200,
    backgroundColor: IOSColors.systemBackground,
  },
  loadingSpinner: {
    marginBottom: IOSSpacing.lg,
  },
  loadingIcon: {
    fontSize: 32,
  },
  loadingText: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
  },
  
  // Error Styles  
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: IOSSpacing.md,
    padding: IOSSpacing.md,
    backgroundColor: IOSColors.systemRed + '10',
    borderRadius: IOSBorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: IOSColors.systemRed,
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
});

export default DailyMemory;

