import { usePinecone } from '@/hooks/usePinecone';
import { formatDateForDisplay, isToday } from '@/utils/dateUtils';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ConversationalAssistant from './conversational-assistant';
import StreamingVoiceAssistant from './streaming-voice-assistant';
import { IOSBorderRadius, IOSCardStyles, IOSColors, IOSSpacing, IOSTypography } from './ui/ios-design-system';

interface DailyMemoryProps {
  selectedDate: string;
  onMemoryUpdate: (hasMemory: boolean) => void;
}

const DailyMemory: React.FC<DailyMemoryProps> = ({ selectedDate, onMemoryUpdate }) => {
  const [memoryText, setMemoryText] = useState('');
  const [existingMemories, setExistingMemories] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [inputMethod, setInputMethod] = useState<'text' | 'voice' | 'conversation'>('text');
  const [showConversationalAssistant, setShowConversationalAssistant] = useState(false);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const { upsertData, isLoading, error } = usePinecone();

  const isTodayDate = () => isToday(selectedDate);
  const formatDate = () => formatDateForDisplay(selectedDate);

  const handleSaveMemory = async () => {
    if (!memoryText.trim()) {
      Alert.alert('Empty Memory', 'Please write something for your memory.');
      return;
    }

    if (!isTodayDate()) {
      Alert.alert('Invalid Date', 'You can only create memories for today.');
      return;
    }

    if (existingMemories.length >= 5 && !editingMemoryId) {
      Alert.alert('Maximum Memories Reached', 'You can only store up to 5 memories per day. Please edit or delete an existing memory.');
      return;
    }

    try {
      const result = await upsertData(memoryText.trim(), { date: selectedDate });
      
      if (result.success) {
        Alert.alert('Success', 'Your memory has been saved!');
        
        if (editingMemoryId) {
          // Update existing memory
          setExistingMemories(prev => prev.map(memory => 
            memory.id === editingMemoryId 
              ? { ...memory, text: memoryText.trim() }
              : memory
          ));
        } else {
          // Add new memory
          const newMemory = { 
            id: `temp-${Date.now()}`, 
            text: memoryText.trim(), 
            date: selectedDate 
          };
          setExistingMemories(prev => [...prev, newMemory]);
        }
        
        setIsEditing(false);
        setEditingMemoryId(null);
        setMemoryText('');
        onMemoryUpdate(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to save memory');
      }
    } catch (err) {
      console.error('Error saving memory:', err);
      Alert.alert('Error', 'Failed to save memory');
    }
  };

  const handleEditMemory = (memory: any) => {
    if (!isTodayDate()) {
      Alert.alert('Cannot Edit', 'You can only edit today\'s memory.');
      return;
    }
    setIsEditing(true);
    setEditingMemoryId(memory.id);
    setMemoryText(memory.text || '');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingMemoryId(null);
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
        const newMemory = { id: `temp-${Date.now()}`, text: memoryText.trim(), date: selectedDate };
        setExistingMemories(prev => [...prev, newMemory]);
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

  const handleVoiceMemoryComplete = async (memoryText: string) => {
    setMemoryText(memoryText);
    setShowVoiceAssistant(false);
    
    // Memory was already saved via WebSocket in the streaming assistant
    // Just update the UI and show success
    console.log('✅ Voice memory completed:', memoryText);
    Alert.alert('Memory Saved!', 'Your voice memory has been saved successfully.');
    const newMemory = { id: `temp-${Date.now()}`, text: memoryText.trim(), date: selectedDate };
    setExistingMemories(prev => [...prev, newMemory]);
    setIsEditing(false);
    onMemoryUpdate(true);
    
    // Refresh the memory display
    loadExistingMemory(selectedDate);
  };

  const handleCloseConversationalAssistant = () => {
    setShowConversationalAssistant(false);
    setIsEditing(false);
  };

  const handleCloseVoiceAssistant = () => {
    setShowVoiceAssistant(false);
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
          if (dayMemory.hasMemory && dayMemory.memories) {
            setExistingMemories(dayMemory.memories.map((memory: any) => ({
              text: memory.text,
              date: date,
              id: memory.id
            })));
          } else {
            setExistingMemories([]);
          }
        } else {
          setExistingMemories([]);
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
    setExistingMemories([]);
    setMemoryText('');
    setIsEditing(false);
    setShowConversationalAssistant(false);
    setShowVoiceAssistant(false);

    // Load existing memory for the selected date
    loadExistingMemory(selectedDate);
  }, [selectedDate]);

  const renderEmptyState = () => {
    if (!isTodayDate()) {
      // Clean message for non-today dates
      return (
        <View style={styles.pastDateContainer}>
          <View style={styles.pastDateContent}>
            <View style={styles.pastDateIconContainer}>
              <Text style={styles.pastDateIcon}>📖</Text>
            </View>
            <Text style={styles.pastDateTitle}>No memory was captured</Text>
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
              setShowVoiceAssistant(true);
            }}
          >
            <Text style={styles.compactOptionIcon}>🎤</Text>
            <Text style={styles.compactOptionText}>Record</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderExistingMemories = () => (
    <View>
      {existingMemories.map((memory, index) => (
        <View key={memory.id || index} style={styles.memoryDisplayContainer}>
          <View style={styles.memoryDisplayHeader}>
            <View style={styles.memoryStatusContainer}>
              <View style={styles.memoryStatusDot} />
              <Text style={styles.memoryStatusText}>Memory {index + 1}</Text>
            </View>
            {isTodayDate() && (
              <TouchableOpacity 
                style={styles.editMemoryButton}
                onPress={() => handleEditMemory(memory)}
              >
                <Text style={styles.editMemoryButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.memoryDisplayText}>{memory.text}</Text>
        </View>
      ))}
      
      {isTodayDate() && existingMemories.length < 5 && (
        <TouchableOpacity 
          style={styles.addMemoryButton}
          onPress={() => setIsEditing(true)}
        >
          <Text style={styles.addMemoryButtonText}>+ Add Memory ({existingMemories.length}/5)</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEditor = () => (
    <View style={styles.editorContainer}>
      <Text style={styles.editorTitle}>
        {editingMemoryId ? 'Edit your memory' : 'Write your memory'}
      </Text>
      <Text style={styles.editorSubtitle}>{formatDate()}</Text>
      
      <TextInput
        style={styles.textInput}
        placeholder="What happened today? How are you feeling? What did you learn?"
        placeholderTextColor={IOSColors.tertiaryLabel}
        value={memoryText}
        onChangeText={setMemoryText}
        multiline
        textAlignVertical="top"
        maxLength={1000}
        editable={!isLoading}
      />
      
      <View style={styles.characterCount}>
        <Text style={styles.characterCountText}>
          {memoryText.length}/1000
        </Text>
      </View>
      
      <View style={styles.editorActions}>
        <TouchableOpacity 
          style={[styles.cancelButton, styles.actionButton]}
          onPress={handleCancelEdit}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.saveButton, styles.actionButton, isLoading && styles.disabledButton]}
          onPress={handleSaveMemory}
          disabled={isLoading || memoryText.length === 0}
        >
          <Text style={styles.saveButtonText}>
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

  if (showVoiceAssistant) {
    return (
      <StreamingVoiceAssistant
        selectedDate={selectedDate}
        onMemoryComplete={handleVoiceMemoryComplete}
        onClose={handleCloseVoiceAssistant}
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
        : existingMemories.length > 0 
          ? renderExistingMemories()
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: IOSColors.systemGray5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IOSSpacing.sm,
  },
  pastDateIcon: {
    fontSize: 18,
  },
  pastDateTitle: {
    ...IOSTypography.callout,
    color: IOSColors.secondaryLabel,
    fontSize: 13,
    textAlign: 'center',
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
  // Memory Display Styles - Compact Version
  memoryDisplayContainer: {
    backgroundColor: IOSColors.systemBackground,
    borderRadius: IOSBorderRadius.lg,
    padding: IOSSpacing.md,
    marginHorizontal: IOSSpacing.md,
    marginBottom: IOSSpacing.sm,
    shadowColor: IOSColors.label,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  memoryDisplayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: IOSSpacing.sm,
  },
  memoryStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memoryStatusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOSColors.systemGreen,
    marginRight: 6,
  },
  memoryStatusText: {
    ...IOSTypography.caption2,
    color: IOSColors.systemGreen,
    fontWeight: '600',
    fontSize: 11,
  },
  editMemoryButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: IOSColors.systemBlue + '15',
    borderRadius: 6,
  },
  editMemoryButtonText: {
    ...IOSTypography.caption2,
    color: IOSColors.systemBlue,
    fontWeight: '600',
    fontSize: 11,
  },
  memoryDisplayText: {
    ...IOSTypography.callout,
    color: IOSColors.label,
    lineHeight: 18,
    fontSize: 13,
  },
  editorContainer: {
    ...IOSCardStyles.insetGrouped,
  },
  editorTitle: {
    ...IOSTypography.callout,
    marginBottom: IOSSpacing.xs,
    color: IOSColors.label,
    fontWeight: '600',
    fontSize: 14,
  },
  editorSubtitle: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
    marginBottom: IOSSpacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 10,
  },
  textInput: {
    ...IOSTypography.callout,
    backgroundColor: IOSColors.tertiarySystemFill,
    borderRadius: IOSBorderRadius.md,
    padding: IOSSpacing.sm,
    minHeight: 80,
    borderWidth: 1,
    borderColor: IOSColors.separator,
    marginBottom: IOSSpacing.sm,
    fontSize: 13,
    lineHeight: 18,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginBottom: IOSSpacing.sm,
  },
  characterCountText: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
    fontSize: 10,
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
  // Compact Button Styles
  cancelButton: {
    backgroundColor: IOSColors.secondarySystemFill,
    borderRadius: IOSBorderRadius.sm,
    paddingVertical: IOSSpacing.xs,
    paddingHorizontal: IOSSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  cancelButtonText: {
    ...IOSTypography.callout,
    color: IOSColors.label,
    fontWeight: '600',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: IOSColors.systemBlue,
    borderRadius: IOSBorderRadius.sm,
    paddingVertical: IOSSpacing.xs,
    paddingHorizontal: IOSSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  saveButtonText: {
    ...IOSTypography.callout,
    color: IOSColors.systemBackground,
    fontWeight: '600',
    fontSize: 13,
  },
  // Add Memory Button
  addMemoryButton: {
    backgroundColor: IOSColors.systemBlue + '15',
    borderRadius: IOSBorderRadius.md,
    paddingVertical: IOSSpacing.sm,
    paddingHorizontal: IOSSpacing.md,
    alignItems: 'center',
    marginTop: IOSSpacing.sm,
    marginHorizontal: IOSSpacing.md,
  },
  addMemoryButtonText: {
    ...IOSTypography.callout,
    color: IOSColors.systemBlue,
    fontWeight: '600',
    fontSize: 13,
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

