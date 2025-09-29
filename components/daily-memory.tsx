import { useAuth } from '@/contexts/AuthContext';
import { usePinecone } from '@/hooks/usePinecone';
import { formatDateForDisplay, isToday } from '@/utils/dateUtils';
import { getSentimentEmoji } from '@/utils/sentimentUtils';
import React, { useEffect, useState } from 'react';
import { Alert, Animated, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ConversationalAssistant from './conversational-assistant';
import FileUploadVoiceAssistant from './file-upload-voice-assistant';
import { ModernBorderRadius, ModernCardStyles, ModernColors, ModernSpacing, ModernTypography } from './ui/modern-design-system';

interface DailyMemoryProps {
  selectedDate: string;
  onMemoryUpdate: (hasMemory: boolean) => void;
  onExpandedChange?: (isExpanded: boolean) => void;
}

const DailyMemory: React.FC<DailyMemoryProps> = ({ selectedDate, onMemoryUpdate, onExpandedChange }) => {
  const [memoryText, setMemoryText] = useState('');
  const [memoryTitle, setMemoryTitle] = useState('');
  const [existingMemories, setExistingMemories] = useState<any[]>([]);
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [showConversationalAssistant, setShowConversationalAssistant] = useState(false);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [animatedValues, setAnimatedValues] = useState<{ [key: string]: Animated.Value }>({});
  const { user } = useAuth();
  const { upsertData, deleteMemory, updateMemory, isLoading, error } = usePinecone();
  const insets = useSafeAreaInsets();

  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;

  const isTodayDate = () => isToday(selectedDate);
  const formatDate = () => formatDateForDisplay(selectedDate);

  // Initialize animated values for each memory
  useEffect(() => {
    const newAnimatedValues: { [key: string]: Animated.Value } = {};
    existingMemories.forEach(memory => {
      if (!animatedValues[memory.id]) {
        newAnimatedValues[memory.id] = new Animated.Value(0);
      }
    });
    if (Object.keys(newAnimatedValues).length > 0) {
      setAnimatedValues(prev => ({ ...prev, ...newAnimatedValues }));
    }
  }, [existingMemories]);

  const handleCardPress = (memoryId: string) => {
    const isCurrentlyExpanded = expandedMemoryId === memoryId;
    
    if (isCurrentlyExpanded) {
      // Collapse animation
      Animated.timing(animatedValues[memoryId], {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setExpandedMemoryId(null);
        onExpandedChange?.(false); // Notify parent that memory is collapsed
      });
    } else {
      // First collapse any currently expanded card
      if (expandedMemoryId && animatedValues[expandedMemoryId]) {
        Animated.timing(animatedValues[expandedMemoryId], {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
      
      // Then expand the new card
      setExpandedMemoryId(memoryId);
      onExpandedChange?.(true); // Notify parent that memory is expanded
      Animated.timing(animatedValues[memoryId], {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }
  };

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
        // Create new memory - pass title in metadata
        result = await upsertData(memoryText.trim(), { 
          date: selectedDate,
          title: memoryTitle.trim() || null // Include title in metadata
        });
      }
      
      if (result.success) {
        Alert.alert('Success', 'Your memory has been saved!');
        
        if (editingMemoryId) {
          // Update existing memory
          setExistingMemories(prev => prev.map(memory => 
            memory.id === editingMemoryId 
              ? { 
                  ...memory, 
                  text: memoryText.trim(), 
                  title: memoryTitle.trim() || null
                }
              : memory
          ));
        } else {
          // Add new memory
          const newMemory = { 
            id: ('id' in result ? result.id : null) || `temp-${Date.now()}`, 
            text: memoryText.trim(),
            title: ('title' in result ? result.title : null) || memoryTitle.trim() || null,
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
                  title: memory.title === 'Untitled Memory' ? null : memory.title,  // Fix old "Untitled Memory" entries
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

  const renderExistingMemories = () => {
    if (existingMemories.length === 0) {
      return null;
    }

    // Define calming but visible pastel colors for mental health journaling
    const cardColors = [
      '#B8E0FF', // Medium Sky Blue - calming but visible
      '#D0B8FF', // Medium Lavender - relaxing but readable
      '#FFBABA', // Medium Blush Pink - comforting but clear
      '#B8F0D0', // Medium Mint Green - healing but visible
      '#FFD6B8', // Medium Peach - warm but readable
      '#C8E8FF', // Medium Alice Blue - serene but clear
      '#E0C8FF', // Medium Lilac - gentle but visible
    ];

    // Tab bar color to match the navbar exactly
    const navbarColor = '#000000'; // Pure black to match tab bar

    return (
      <View style={styles.walletContainer}>
        {/* Base navbar-colored card with custom rounded implementation */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 200, // Increased from 180 to accommodate extra padding
            zIndex: 1000, // High z-index to be above memory cards
          }}
        >
          {/* Rounded top corners using pseudo-elements approach */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 20, // Height of the border radius
              backgroundColor: 'transparent',
            }}
          >
            {/* Left rounded corner */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 20,
                height: 20,
                backgroundColor: navbarColor,
                borderTopLeftRadius: 20,
              }}
            />
            {/* Right rounded corner */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 20,
                height: 20,
                backgroundColor: navbarColor,
                borderTopRightRadius: 20,
              }}
            />
            {/* Top center fill */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 20,
                right: 20,
                height: 20,
                backgroundColor: navbarColor,
              }}
            />
          </View>
          
          {/* Main card body */}
          <View
            style={{
              position: 'absolute',
              top: 20,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: navbarColor,
            }}
          >
            <View style={styles.walletCardTouchArea}>
              <View style={styles.navbarCardContent}>
                <Text style={styles.navbarCardSubtitle}>Create memories</Text>
                <View style={styles.navbarCardButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.navbarButton}
                    onPress={() => setShowVoiceAssistant(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.recordButtonContent}>
                      <View style={styles.recordDot} />
                      <Text style={styles.navbarButtonText}>Record</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Memory cards stacked behind the navbar card */}
        {existingMemories.map((memory, index) => {
          const isExpanded = expandedMemoryId === memory.id;
          const cardColor = cardColors[index % cardColors.length];
          // Increased exposed area for better title visibility - 100px visible area
          const stackOffset = (index + 1) * 100; // +1 to account for navbar card at 0, increased from 60 to 100
          const animatedValue = animatedValues[memory.id] || new Animated.Value(0);
          
          // Animated style interpolations for full-screen expansion
          const animatedHeight = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [220, screenHeight], // Increased from 180 to 220 to accommodate time + title
          });
          
          const animatedBottom = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [isExpanded ? 0 : stackOffset, 0],
          });
          
          const animatedBorderRadius = animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [ModernBorderRadius.xl, 0],
          });
          
          const animatedZIndex = isExpanded ? 2000 : (existingMemories.length - index + 1); // +1 for navbar card
          
          return (
            <Animated.View
              key={memory.id || index}
              style={[
                styles.walletCard,
                {
                  backgroundColor: cardColor,
                  height: animatedHeight,
                  bottom: animatedBottom,
                  zIndex: animatedZIndex,
                  borderTopLeftRadius: animatedBorderRadius,
                  borderTopRightRadius: animatedBorderRadius,
                },
              ]}
            >
              {!isExpanded ? (
                <TouchableOpacity
                  style={styles.walletCardTouchArea}
                  onPress={() => handleCardPress(memory.id)}
                  activeOpacity={0.9}
                >
                  <View style={styles.walletCardHeader}>
                  <View style={styles.walletCardTitleSection}>
                    {!isExpanded && (
                      <Text style={styles.walletCardTime}>
                        {new Date(memory.timestamp || memory.date || Date.now()).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </Text>
                    )}
                    <Text style={styles.walletCardTitle} numberOfLines={isExpanded ? undefined : 4}>
                      {memory.title || `Memory from ${formatDateForDisplay(selectedDate)}`}
                    </Text>
                  </View>
                  {memory.sentiment && (
                    <Text style={styles.walletCardEmoji}>
                      {getSentimentEmoji(memory.sentiment)}
                    </Text>
                  )}
                </View>
                </TouchableOpacity>
              ) : null}
                
              {isExpanded && (
                <Animated.View 
                  style={[
                    styles.expandedMemoryContainer,
                    {
                      opacity: animatedValue,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 2000,
                    }
                  ]}
                >
                  <SafeAreaView style={styles.expandedSafeArea} edges={['top', 'left', 'right']}>
                    {/* Header with close button and action icons */}
                    <View style={[styles.expandedHeader, { paddingTop: insets.top + ModernSpacing.md }]}>
                    <TouchableOpacity 
                      style={styles.closeButton}
                      onPress={() => handleCardPress(memory.id)}
                    >
                      <Text style={styles.closeButtonText}>×</Text>
                    </TouchableOpacity>
                    
                    {isTodayDate() && (
                      <View style={styles.headerActions}>
                        <TouchableOpacity 
                          style={styles.headerActionButton}
                          onPress={() => handleDeleteMemory(memory)}
                        >
                          <Text style={styles.headerActionIcon}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Memory content */}
                  <View style={styles.expandedContent}>
                    <View style={styles.expandedTitleSection}>
                      <Text style={styles.expandedTitle}>
                        {memory.title || `Memory from ${formatDateForDisplay(selectedDate)}`}
                      </Text>
                      {memory.sentiment && (
                        <Text style={styles.expandedEmoji}>
                          {getSentimentEmoji(memory.sentiment)}
                        </Text>
                      )}
                    </View>
                    
                    <Text style={styles.expandedDate}>
                      {formatDateForDisplay(selectedDate)}
                    </Text>
                    
                    <View style={styles.expandedTextSection}>
                      <Text style={styles.expandedText}>{memory.text}</Text>
                    </View>
                  </View>

                  {/* Floating Action Buttons */}
                  <View style={styles.floatingButtonsContainer}>
                    <TouchableOpacity style={styles.floatingButton}>
                      <Text style={styles.floatingButtonIcon}>⚕️</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.floatingButton}
                      onPress={() => handleEditMemory(memory)}
                    >
                      <Text style={styles.floatingButtonIcon}>✏️</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.floatingButton}>
                      <Text style={styles.floatingButtonIcon}>📎</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.floatingButton}>
                      <Text style={styles.floatingButtonIcon}>☰</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.floatingButtonPrimary}>
                      <Text style={styles.floatingButtonPrimaryIcon}>+</Text>
                    </TouchableOpacity>
                  </View>
                  </SafeAreaView>
                </Animated.View>
              )}
            </Animated.View>
          );
        })}
      </View>
    );
  };

  const renderEditor = () => (
    <View style={styles.editorContainer}>
      <Text style={styles.editorTitle}>
        {editingMemoryId ? 'Edit your memory' : 'Write your memory'}
      </Text>
      <Text style={styles.editorSubtitle}>{formatDate()}</Text>
      
      <TextInput
        style={styles.titleInput}
        placeholder="Memory title (optional - AI will generate if empty)"
        placeholderTextColor={ModernColors.tertiary}
        value={memoryTitle}
        onChangeText={setMemoryTitle}
        maxLength={50}
        editable={!isLoading}
      />
      
      <TextInput
        style={styles.textInput}
        placeholder="What happened today? How are you feeling? What did you learn?"
        placeholderTextColor={ModernColors.tertiary}
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
    ...ModernCardStyles.base,
    paddingVertical: ModernSpacing['2xl'],
    backgroundColor: ModernColors.secondaryBackground,
  },
  pastDateContent: {
    alignItems: 'center',
  },
  pastDateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ModernColors.secondaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ModernSpacing.sm,
  },
  pastDateIcon: {
    fontSize: 18,
  },
  pastDateTitle: {
    ...ModernTypography.callout,
    color: ModernColors.secondary,
    fontSize: 13,
    textAlign: 'center',
  },
  
  // Today Empty State Styles - Compact Version
  todayEmptyState: {
    ...ModernCardStyles.base,
    paddingVertical: ModernSpacing.lg,
    backgroundColor: ModernColors.cardBackground,
    paddingHorizontal: ModernSpacing.lg + ModernSpacing.md, // Match calendar's total padding (24+16=40px)
  },
  compactHeader: {
    alignItems: 'center',
    marginBottom: ModernSpacing.lg,
  },
  compactTitle: {
    ...ModernTypography.title2,
    color: ModernColors.primary,
    marginBottom: ModernSpacing.xs,
  },
  compactSubtitle: {
    ...ModernTypography.subhead,
    color: ModernColors.secondary,
    textAlign: 'center',
  },
  
  // Compact Creation Options
  compactOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ModernSpacing.lg,
    paddingHorizontal: ModernSpacing.md,
  },
  compactOption: {
    alignItems: 'center',
    padding: ModernSpacing.lg,
    backgroundColor: ModernColors.secondaryBackground,
    borderRadius: ModernBorderRadius.xl,
    minWidth: 100,
    flex: 1,
    maxWidth: 140,
  },
  compactOptionIcon: {
    fontSize: 28,
    marginBottom: ModernSpacing.xs,
  },
  compactOptionText: {
    ...ModernTypography.subhead,
    color: ModernColors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  editorContainer: {
    ...ModernCardStyles.base,
    paddingHorizontal: ModernSpacing.lg + ModernSpacing.md, // Match calendar's total padding (24+16=40px)
  },
  editorTitle: {
    ...ModernTypography.callout,
    marginBottom: ModernSpacing.xs,
    color: ModernColors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  editorSubtitle: {
    ...ModernTypography.caption2,
    color: ModernColors.secondary,
    marginBottom: ModernSpacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 10,
  },
  titleInput: {
    ...ModernTypography.body,
    backgroundColor: ModernColors.cardBackground,
    borderRadius: ModernBorderRadius.md,
    padding: ModernSpacing.sm,
    borderWidth: 1,
    borderColor: ModernColors.border,
    marginBottom: ModernSpacing.sm,
    fontSize: 15,
    fontWeight: '600',
    color: ModernColors.primary,
  },
  
  textInput: {
    ...ModernTypography.callout,
    backgroundColor: ModernColors.cardBackground,
    borderRadius: ModernBorderRadius.md,
    padding: ModernSpacing.sm,
    minHeight: 80,
    borderWidth: 1,
    borderColor: ModernColors.border,
    marginBottom: ModernSpacing.sm,
    fontSize: 13,
    lineHeight: 18,
  },
  characterCount: {
    alignItems: 'flex-end',
    marginBottom: ModernSpacing.sm,
  },
  characterCountText: {
    ...ModernTypography.caption2,
    color: ModernColors.secondary,
    fontSize: 10,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: ModernSpacing.md,
  },
  actionButton: {
    flex: 1,
  },
  disabledButton: {
    opacity: 0.6,
  },
  // Compact Button Styles
  cancelButton: {
    backgroundColor: ModernColors.secondaryBackground,
    borderRadius: ModernBorderRadius.sm,
    paddingVertical: ModernSpacing.xs,
    paddingHorizontal: ModernSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  cancelButtonText: {
    ...ModernTypography.callout,
    color: ModernColors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: ModernColors.accent,
    borderRadius: ModernBorderRadius.sm,
    paddingVertical: ModernSpacing.xs,
    paddingHorizontal: ModernSpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  saveButtonText: {
    ...ModernTypography.callout,
    color: ModernColors.cardBackground,
    fontWeight: '600',
    fontSize: 13,
  },
  
  // Add Memory Section - Modern card design
  voiceInputContainer: {
    backgroundColor: ModernColors.secondaryBackground,
    borderRadius: ModernBorderRadius.lg,
    padding: ModernSpacing.lg,
    marginBottom: ModernSpacing.md,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptionPreview: {
    marginTop: ModernSpacing.lg,
    padding: ModernSpacing.md,
    backgroundColor: ModernColors.cardBackground,
    borderRadius: ModernBorderRadius.md,
    borderWidth: 1,
    borderColor: ModernColors.border,
    width: '100%',
  },
  transcriptionLabel: {
    ...ModernTypography.caption1,
    color: ModernColors.secondary,
    marginBottom: ModernSpacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptionText: {
    ...ModernTypography.body,
    lineHeight: 22,
  },
  // Loading Styles
  loadingContainer: {
    ...ModernCardStyles.base,
    justifyContent: 'center',
    alignItems: 'center',
     paddingVertical: ModernSpacing['2xl'],
    minHeight: 200,
    backgroundColor: ModernColors.cardBackground,
    paddingHorizontal: ModernSpacing.lg + ModernSpacing.md, // Match calendar's total padding (24+16=40px)
  },
  loadingSpinner: {
    marginBottom: ModernSpacing.lg,
  },
  loadingIcon: {
    fontSize: 32,
  },
  loadingText: {
    ...ModernTypography.callout,
    color: ModernColors.secondary,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  
  // Error Styles  
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: ModernSpacing.md,
    padding: ModernSpacing.md,
    backgroundColor: ModernColors.error + '10',
    borderRadius: ModernBorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: ModernColors.error,
  },
  errorIcon: {
    fontSize: 20,
    marginRight: ModernSpacing.sm,
  },
  errorText: {
    ...ModernTypography.callout,
    color: ModernColors.error,
    fontSize: 13,
    lineHeight: 18,
  },
  
  // Wallet-Style Cards - Apple Wallet inspired  
  walletContainer: {
    position: 'absolute',
    bottom: 0, // Changed from -34 to prevent clipping
    left: 0,
    right: 0,
    minHeight: 600, // Reduced from 900px for smaller cards
    paddingBottom: 150, // Increased from 117 to better accommodate home indicator and tab bar
    zIndex: 100, // Ensure cards appear above other content
  },
  
  walletCard: {
    position: 'absolute',
    left: 0, // Full width within container
    right: 0, // Full width within container
    borderTopLeftRadius: ModernBorderRadius.xl, // Top corners rounded
    borderTopRightRadius: ModernBorderRadius.xl, // Top corners rounded
    borderBottomLeftRadius: 0, // No bottom rounding
    borderBottomRightRadius: 0, // No bottom rounding
    // Remove all shadows for cleaner appearance
    minHeight: 220, // Increased to accommodate time + title properly
    height: 220, // Fixed height to ensure consistency
    overflow: 'visible', // Ensure rounded corners are rendered properly
  },
  
  walletCardTouchArea: {
    flex: 1,
    paddingHorizontal: 0, // Remove all horizontal padding for true edge-to-edge
    paddingVertical: ModernSpacing.lg,
    paddingTop: ModernSpacing.lg,
    minHeight: 220, // Match the increased card height
  },
  
  walletCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: ModernSpacing.sm,
    paddingHorizontal: ModernSpacing.xl, // Add padding only to header content, not the card itself
  },
  
  walletCardTime: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    marginBottom: ModernSpacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  walletCardTitleSection: {
    flex: 1,
    marginRight: ModernSpacing.xs, // Reduced margin to give more space to title
  },
  
  walletCardTitle: {
    ...ModernTypography.title3,
    color: '#000000', // Black text for better readability
    fontWeight: '700',
    fontSize: 17, // Reduced from 18 to fit more text
    lineHeight: 22, // Reduced from 24 to fit more lines
    // Remove text shadow for cleaner appearance
  },
  
  walletCardEmoji: {
    fontSize: 24,
    marginLeft: ModernSpacing.sm,
    // Remove text shadow for cleaner appearance
  },
  
  walletCardContent: {
    marginTop: ModernSpacing.sm, // Reduced from lg to give more space for text
    flex: 1,
    paddingHorizontal: ModernSpacing.xl, // Add padding to content area
    paddingBottom: ModernSpacing.md, // Add bottom padding
  },
  
  walletCardText: {
    ...ModernTypography.body,
    color: '#000000', // Black text for better readability
    fontSize: 14, // Reduced from 15 to fit more text
    lineHeight: 20, // Reduced from 22 to fit more text
    marginBottom: 0, // Remove bottom margin to maximize space
    // Remove text shadow for cleaner appearance
  },
  
  walletCardActions: {
    flexDirection: 'row',
    gap: ModernSpacing.md,
    marginTop: 'auto',
  },
  
  walletActionButton: {
    paddingVertical: ModernSpacing.sm,
    paddingHorizontal: ModernSpacing.lg,
    borderRadius: ModernBorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  
  editWalletButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  
  deleteWalletButton: {
    backgroundColor: 'rgba(255,0,0,0.2)',
    borderColor: 'rgba(255,0,0,0.4)',
  },
  
  walletActionButtonText: {
    ...ModernTypography.callout,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  navbarCard: {
    // Static card that sits right above the navbar with rounded top corners
    borderTopLeftRadius: ModernBorderRadius.xl,
    borderTopRightRadius: ModernBorderRadius.xl,
  },
  
  navbarCardTitle: {
    ...ModernTypography.title3,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    opacity: 0.9,
  },
  
  navbarCardContent: {
    flex: 1,
    justifyContent: 'flex-end', // Push content towards bottom
    alignItems: 'center',
    paddingBottom: ModernSpacing.xl, // More space below button
  },
  
  navbarCardSubtitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '400', // Not bold
    textAlign: 'center',
    marginBottom: ModernSpacing.lg, // More space between text and button
    opacity: 0.8,
  },
  
  navbarCardButtonsContainer: {
    width: '100%',
    paddingHorizontal: ModernSpacing.lg,
    paddingBottom: ModernSpacing.xl + ModernSpacing.lg, // Increased padding to avoid home indicator clipping
  },
  
  navbarButton: {
    backgroundColor: '#FFFFFF', // White background
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.xl,
    borderRadius: ModernBorderRadius.xl, // More rounded edges (20px)
    width: '100%', // Full width since there's only one button
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  navbarButtonText: {
    color: '#000000', // Black text
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  recordButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF0000', // Red dot
    marginRight: 8,
  },
  
  // Expanded Memory Styles
  expandedMemoryContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  
  expandedSafeArea: {
    flex: 1,
    paddingHorizontal: ModernSpacing.md,
  },
  
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ModernSpacing.xl,
    paddingBottom: ModernSpacing.md,
  },
  
  headerActions: {
    flexDirection: 'row',
    gap: ModernSpacing.sm,
  },
  
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  headerActionIcon: {
    fontSize: 18,
  },
  
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  closeButtonText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#000000',
  },
  
  expandedContent: {
    flex: 1,
    paddingHorizontal: ModernSpacing.xl,
    paddingVertical: ModernSpacing.lg,
  },
  
  expandedTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: ModernSpacing.xl,
  },
  
  expandedTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    lineHeight: 34,
  },
  
  expandedEmoji: {
    fontSize: 32,
    marginLeft: ModernSpacing.md,
  },
  
  expandedDate: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
    marginBottom: ModernSpacing.xl,
    paddingHorizontal: ModernSpacing.xs,
  },
  
  expandedTextSection: {
    marginBottom: ModernSpacing.xl,
  },
  
  expandedText: {
    fontSize: 18,
    lineHeight: 26,
    color: '#333333',
    marginBottom: ModernSpacing.lg,
  },
  
  // Floating Action Buttons
  floatingButtonsContainer: {
    position: 'absolute',
    bottom: 80, // Position above bottom navigation
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ModernSpacing.lg,
    paddingVertical: ModernSpacing.md,
    borderRadius: 50, // Make it a large pill/circular shape
    minWidth: 320,
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // Same as close button background
    zIndex: 1000, // High z-index to appear above other elements
  },
  
  floatingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  floatingButtonIcon: {
    fontSize: 18,
    color: '#000000',
  },
  
  floatingButtonPrimary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  floatingButtonPrimaryIcon: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '200',
  },
});

export default DailyMemory;

