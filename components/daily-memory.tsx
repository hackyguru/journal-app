import { useAuth } from '@/contexts/AuthContext';
import { usePinecone } from '@/hooks/usePinecone';
import { formatDateForDisplay, isToday } from '@/utils/dateUtils';
import { getSentimentEmoji } from '@/utils/sentimentUtils';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ConversationalAssistant from './conversational-assistant';
import FileUploadVoiceAssistant from './file-upload-voice-assistant';
import { IOSBorderRadius, IOSCardStyles, IOSColors, IOSSpacing, IOSTypography } from './ui/ios-design-system';

interface DailyMemoryProps {
  selectedDate: string;
  onMemoryUpdate: (hasMemory: boolean) => void;
}

const DailyMemory: React.FC<DailyMemoryProps> = ({ selectedDate, onMemoryUpdate }) => {
  const [memoryText, setMemoryText] = useState('');
  const [memoryTitle, setMemoryTitle] = useState('');
  const [existingMemories, setExistingMemories] = useState<any[]>([]);
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [showConversationalAssistant, setShowConversationalAssistant] = useState(false);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const { user } = useAuth();
  const { upsertData, deleteMemory, updateMemory, isLoading, error } = usePinecone();

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
      let result;
      
      if (editingMemoryId) {
        // Update existing memory
        result = await updateMemory(editingMemoryId, memoryText.trim(), memoryTitle.trim());
      } else {
        // Create new memory
        result = await upsertData(memoryText.trim(), { date: selectedDate });
      }
      
      if (result.success) {
        Alert.alert('Success', 'Your memory has been saved!');
        
        if (editingMemoryId) {
          // Update existing memory
          setExistingMemories(prev => prev.map(memory => 
            memory.id === editingMemoryId 
              ? { ...memory, text: memoryText.trim(), title: result.title || memoryTitle.trim() }
              : memory
          ));
        } else {
          // Add new memory
          const newMemory = { 
            id: result.id || `temp-${Date.now()}`, 
            text: memoryText.trim(),
            title: result.title || 'Untitled Memory',
            date: selectedDate 
          };
          setExistingMemories(prev => [...prev, newMemory]);
        }
        
        setIsEditing(false);
        setEditingMemoryId(null);
        setMemoryText('');
        setMemoryTitle('');
        onMemoryUpdate(true);
      } else {
        // Handle specific error cases with user-friendly messages
        if (result.error && result.error.includes('Maximum memories reached')) {
          Alert.alert(
            'Memory Limit Reached',
            'You can only store up to 5 memories per day. Please edit or delete an existing memory to add a new one.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', result.error || 'Failed to save memory');
        }
      }
    } catch (err: any) {
      console.error('Error saving memory:', err);
      
      // Handle specific error cases with user-friendly messages
      if (err.message && err.message.includes('Maximum memories reached')) {
        Alert.alert(
          'Memory Limit Reached',
          'You can only store up to 5 memories per day. Please edit or delete an existing memory to add a new one.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to save memory');
      }
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
    setMemoryTitle(memory.title || '');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingMemoryId(null);
    setMemoryText('');
    setMemoryTitle('');
  };

  const handleDeleteMemory = (memory: any) => {
    if (!isTodayDate()) {
      Alert.alert('Cannot Delete', 'You can only delete today\'s memories.');
      return;
    }

    Alert.alert(
      'Delete Memory',
      'Are you sure you want to delete this memory? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteMemory(memory.id);
              
              if (result.success) {
                Alert.alert('Success', 'Memory deleted successfully');
                // Remove the memory from local state
                setExistingMemories(prev => prev.filter(m => m.id !== memory.id));
                // Update parent component
                onMemoryUpdate(existingMemories.length > 1);
              } else {
                Alert.alert('Error', result.error || 'Failed to delete memory');
              }
            } catch (err) {
              console.error('Error deleting memory:', err);
              Alert.alert('Error', 'Failed to delete memory');
            }
          },
        },
      ]
    );
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
        // Handle specific error cases with user-friendly messages
        if (result.error && result.error.includes('Maximum memories reached')) {
          Alert.alert(
            'Memory Limit Reached',
            'You can only store up to 5 memories per day. Please edit or delete an existing memory to add a new one.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', result.error || 'Failed to save memory');
        }
      }
    } catch (err: any) {
      console.error('Error saving conversational memory:', err);
      
      // Handle specific error cases with user-friendly messages
      if (err.message && err.message.includes('Maximum memories reached')) {
        Alert.alert(
          'Memory Limit Reached',
          'You can only store up to 5 memories per day. Please edit or delete an existing memory to add a new one.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to save memory');
      }
    }
  };

  const handleVoiceMemoryComplete = async (memoryText: string) => {
    setMemoryText(memoryText);
    setShowVoiceAssistant(false);
    
    // Memory was already saved by the voice assistant
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
      // Ensure user is authenticated
      if (!user?.id) {
        console.log('No user authenticated, skipping memory load');
        setExistingMemories([]);
        setIsLoadingMemory(false);
        return;
      }

      // Use the same approach as the week endpoint - get all memories with metadata
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      
      // Create a single-day week request to get the memory for this specific date
      const response = await fetch(`${backendUrl}/api/memories/week?startDate=${date}&userId=${user.id}`, {
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
                  title: memory.title || 'Untitled Memory',  // 📝 Include title with fallback
                  date: date,
                  id: memory.id,
                  sentiment: memory.sentiment,           // 🎭 Include sentiment data
                  sentimentConfidence: memory.sentimentConfidence // 🎭 Include sentiment confidence
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
  }, [selectedDate, user]);

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
        <View key={memory.id || index} style={styles.memoryCard}>
          <TouchableOpacity 
            style={styles.memoryCardHeader}
            onPress={() => setExpandedMemoryId(expandedMemoryId === memory.id ? null : memory.id)}
            activeOpacity={0.7}
          >
            <View style={styles.memoryHeaderLeft}>
              <View style={styles.memoryStatusDot} />
              <Text style={styles.memoryTitle} numberOfLines={expandedMemoryId === memory.id ? undefined : 2}>
                {memory.title}
              </Text>
              {memory.sentiment && (
                <Text style={styles.sentimentEmoji}>
                  {getSentimentEmoji(memory.sentiment)}
                </Text>
              )}
            </View>
            <Text style={styles.expandIcon}>
              {expandedMemoryId === memory.id ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          
          {expandedMemoryId === memory.id && (
            <View style={styles.memoryExpandedContent}>
              <Text style={styles.memoryDisplayText}>{memory.text}</Text>
              {isTodayDate() && (
                <View style={styles.memoryActions}>
                  <TouchableOpacity 
                    style={styles.editMemoryButton}
                    onPress={() => handleEditMemory(memory)}
                  >
                    <Text style={styles.editMemoryButtonText}>Edit</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.deleteMemoryButton}
                    onPress={() => handleDeleteMemory(memory)}
                  >
                    <Text style={styles.deleteMemoryButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      ))}
      
      {isTodayDate() && existingMemories.length < 5 && !isEditing && (
        <View style={styles.addMemorySection}>
          <Text style={styles.addMemoryTitle}>Add Memory ({existingMemories.length}/5)</Text>
          
          <View style={styles.compactOptions}>
            <TouchableOpacity 
              style={styles.compactOption}
              onPress={() => setIsEditing(true)}
            >
              <Text style={styles.compactOptionIcon}>✍️</Text>
              <Text style={styles.compactOptionText}>Write</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.compactOption}
              onPress={() => setShowVoiceAssistant(true)}
            >
              <Text style={styles.compactOptionIcon}>🎤</Text>
              <Text style={styles.compactOptionText}>Record</Text>
            </TouchableOpacity>
          </View>
        </View>
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
        style={styles.titleInput}
        placeholder="Memory title (optional - AI will generate if empty)"
        placeholderTextColor={IOSColors.tertiaryLabel}
        value={memoryTitle}
        onChangeText={setMemoryTitle}
        maxLength={50}
        editable={!isLoading}
      />
      
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
      <FileUploadVoiceAssistant
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
    // No margin - individual components now handle their own margins to align with calendar
  },
  
  // Past Date Styles
  pastDateContainer: {
    ...IOSCardStyles.insetGrouped,
    paddingVertical: IOSSpacing['2xl'],
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    paddingHorizontal: IOSSpacing.lg + IOSSpacing.md, // Match calendar's total padding (24+16=40px)
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
    paddingHorizontal: IOSSpacing.lg + IOSSpacing.md, // Match calendar's total padding (24+16=40px)
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
  // Memory Card Styles - Expandable cards with titles
  memoryCard: {
    ...IOSCardStyles.insetGrouped,
    marginHorizontal: IOSSpacing.md,
    marginBottom: IOSSpacing.sm,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: IOSBorderRadius.md,
    overflow: 'hidden',
  },
  
  memoryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.md,
  },
  
  memoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: IOSSpacing.sm,
  },
  
  memoryTitle: {
    ...IOSTypography.body,
    color: IOSColors.label,
    fontWeight: '600',
    flex: 1,
    marginLeft: IOSSpacing.sm,
  },
  
  expandIcon: {
    ...IOSTypography.caption1,
    color: IOSColors.tertiaryLabel,
    fontWeight: '600',
  },
  
  memoryExpandedContent: {
    paddingHorizontal: IOSSpacing.md,
    paddingBottom: IOSSpacing.md,
    borderTopWidth: 1,
    borderTopColor: IOSColors.separator,
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
  
  sentimentEmoji: {
    fontSize: 16,
    marginLeft: IOSSpacing.xs,
  },
  
  memoryActions: {
    flexDirection: 'row',
    gap: IOSSpacing.xs,
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
  
  deleteMemoryButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: IOSColors.systemRed + '15',
    borderRadius: 6,
  },
  deleteMemoryButtonText: {
    ...IOSTypography.caption2,
    color: IOSColors.systemRed,
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
    paddingHorizontal: IOSSpacing.lg + IOSSpacing.md, // Match calendar's total padding (24+16=40px)
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
  titleInput: {
    ...IOSTypography.body,
    backgroundColor: IOSColors.tertiarySystemFill,
    borderRadius: IOSBorderRadius.md,
    padding: IOSSpacing.sm,
    borderWidth: 1,
    borderColor: IOSColors.separator,
    marginBottom: IOSSpacing.sm,
    fontSize: 15,
    fontWeight: '600',
    color: IOSColors.label,
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
  // Add Memory Section - Match calendar width
  addMemorySection: {
    ...IOSCardStyles.insetGrouped, // Same base as calendar
    marginHorizontal: IOSSpacing.md, // Same override as calendar
    paddingHorizontal: IOSSpacing.md, // Same additional padding as calendar
    paddingVertical: IOSSpacing.md,
    marginTop: IOSSpacing.sm,
    marginBottom: 0,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: IOSBorderRadius.md,
  },
  addMemoryTitle: {
    ...IOSTypography.subhead,
    color: IOSColors.label,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: IOSSpacing.sm,
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
    ...IOSTypography.callout,
    color: IOSColors.systemRed,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
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
    paddingHorizontal: IOSSpacing.lg + IOSSpacing.md, // Match calendar's total padding (24+16=40px)
  },
  loadingSpinner: {
    marginBottom: IOSSpacing.lg,
  },
  loadingIcon: {
    fontSize: 32,
  },
  loadingText: {
    ...IOSTypography.callout,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
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
});

export default DailyMemory;

