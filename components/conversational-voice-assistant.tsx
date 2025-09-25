import { Ionicons } from '@expo/vector-icons';
import { AudioRecorder, requestPermissionsAsync } from 'expo-audio';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSBorderRadius, IOSCardStyles, IOSColors, IOSSpacing, IOSTypography, useIOSSafeAreaStyles } from './ui/ios-design-system';

interface ConversationalVoiceAssistantProps {
  selectedDate: string;
  onMemoryComplete: (memoryText: string) => void;
  onClose: () => void;
}

interface ConversationState {
  stage: 'greeting' | 'listening' | 'processing' | 'confirming' | 'complete';
  transcript: string;
  assistantMessage: string;
}

const ConversationalVoiceAssistant: React.FC<ConversationalVoiceAssistantProps> = ({
  selectedDate,
  onMemoryComplete,
  onClose,
}) => {
  const [conversation, setConversation] = useState<ConversationState>({
    stage: 'greeting',
    transcript: '',
    assistantMessage: "Hi! I'm here to help you capture your memories. Tell me about your day - how are you feeling? What happened today that you'd like to remember?"
  });
  
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<AudioRecorder | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const safeAreaStyles = useIOSSafeAreaStyles();

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const { status } = await requestPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need microphone access to record your memories.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      setHasPermission(false);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      await requestPermissions();
      return;
    }

    try {
      setIsRecording(true);
      setConversation(prev => ({
        ...prev,
        stage: 'listening',
        assistantMessage: "I'm listening... tell me about your day!"
      }));

      const newRecorder = new AudioRecorder({
        android: {
          extension: '.wav',
          outputFormat: 'default',
          audioEncoder: 'default',
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: 'high',
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      await newRecorder.startAsync();
      setRecorder(newRecorder);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recorder) return;

    try {
      setIsRecording(false);
      setIsProcessing(true);
      setConversation(prev => ({
        ...prev,
        stage: 'processing',
        assistantMessage: "Let me process what you said..."
      }));

      const uri = await recorder.stopAsync();
      
      if (uri) {
        await transcribeAudio(uri);
      }
      
      setRecorder(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Recording Error', 'Failed to process recording. Please try again.');
      setIsProcessing(false);
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    try {
      console.log('🎤 Starting transcription for:', audioUri);
      
      const formData = new FormData();
      // React Native FormData requires this specific format
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/wav',
        name: 'memory-recording.wav',
      } as any);

      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      console.log('📡 Sending request to:', `${backendUrl}/api/transcribe`);
      
      const response = await fetch(`${backendUrl}/api/transcribe`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type - let fetch set it automatically with boundary
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Transcription result:', result);
      
      if (result.success && result.transcript) {
        setConversation(prev => ({
          ...prev,
          stage: 'confirming',
          transcript: result.transcript,
          assistantMessage: "Great! I heard you say: \"" + result.transcript + "\"\n\nIs this what you'd like to save as your memory?"
        }));
      } else {
        throw new Error(result.error || 'Transcription failed');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert(
        'Transcription Error', 
        'Failed to transcribe your recording. Please try again.',
        [
          { text: 'Try Again', onPress: () => setConversation(prev => ({ ...prev, stage: 'greeting' })) },
          { text: 'Cancel', onPress: onClose }
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmMemory = () => {
    setConversation(prev => ({
      ...prev,
      stage: 'complete',
      assistantMessage: "Perfect! I've saved your memory. Thank you for sharing!"
    }));
    
    setTimeout(() => {
      onMemoryComplete(conversation.transcript);
    }, 1500);
  };

  const retryRecording = () => {
    setConversation(prev => ({
      ...prev,
      stage: 'greeting',
      transcript: '',
      assistantMessage: "Let's try again. Tell me about your day - what would you like to remember?"
    }));
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

  const renderRecordingButton = () => {
    if (isProcessing) {
      return (
        <View style={styles.processingContainer}>
          <View style={styles.processingSpinner}>
            <Text style={styles.processingIcon}>⏳</Text>
          </View>
          <Text style={styles.processingText}>Processing your memory...</Text>
        </View>
      );
    }

    if (conversation.stage === 'confirming') {
      return (
        <View style={styles.confirmationContainer}>
          <TouchableOpacity 
            style={styles.confirmButton}
            onPress={confirmMemory}
          >
            <Text style={styles.confirmButtonText}>✓ Save This Memory</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={retryRecording}
          >
            <Text style={styles.retryButtonText}>🎤 Record Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (conversation.stage === 'complete') {
      return (
        <View style={styles.completeContainer}>
          <Text style={styles.completeIcon}>✨</Text>
          <Text style={styles.completeText}>Memory saved successfully!</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordingButton,
          !hasPermission && styles.disabledButton
        ]}
        onPress={isRecording ? stopRecording : startRecording}
        disabled={!hasPermission || isProcessing}
      >
        <View style={[
          styles.recordButtonInner,
          isRecording && styles.recordingButtonInner
        ]}>
          <Ionicons 
            name={isRecording ? "stop" : "mic"} 
            size={32} 
            color={IOSColors.systemBackground} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Voice Memory</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={IOSColors.secondaryLabel} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>🎤</Text>
          <Text style={styles.permissionTitle}>Microphone Access Required</Text>
          <Text style={styles.permissionText}>
            We need access to your microphone to record your memories.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Voice Memory</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={IOSColors.secondaryLabel} />
        </TouchableOpacity>
      </View>

      {/* Date */}
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>{formatDate()}</Text>
      </View>

      {/* Assistant Message */}
      <View style={styles.assistantContainer}>
        <View style={styles.assistantBubble}>
          <Text style={styles.assistantText}>{conversation.assistantMessage}</Text>
        </View>
      </View>

      {/* Transcript Display */}
      {conversation.transcript && conversation.stage === 'confirming' && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptLabel}>Your Memory:</Text>
          <Text style={styles.transcriptText}>{conversation.transcript}</Text>
        </View>
      )}

      {/* Recording Controls */}
      <View style={styles.controlsContainer}>
        {renderRecordingButton()}
        
        {conversation.stage === 'listening' && (
          <Text style={styles.listeningText}>Listening... Tap to stop</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOSColors.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IOSSpacing.lg,
    paddingVertical: IOSSpacing.md,
    backgroundColor: IOSColors.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
  },
  headerTitle: {
    ...IOSTypography.title2,
    color: IOSColors.label,
  },
  closeButton: {
    padding: IOSSpacing.sm,
  },
  dateContainer: {
    padding: IOSSpacing.lg,
    alignItems: 'center',
  },
  dateText: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  assistantContainer: {
    flex: 1,
    paddingHorizontal: IOSSpacing.lg,
    justifyContent: 'center',
  },
  assistantBubble: {
    ...IOSCardStyles.grouped,
    backgroundColor: IOSColors.systemBackground,
    padding: IOSSpacing.lg,
  },
  assistantText: {
    ...IOSTypography.body,
    color: IOSColors.label,
    lineHeight: 24,
    textAlign: 'center',
  },
  transcriptContainer: {
    marginHorizontal: IOSSpacing.lg,
    marginBottom: IOSSpacing.lg,
    padding: IOSSpacing.lg,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: IOSBorderRadius.lg,
  },
  transcriptLabel: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    marginBottom: IOSSpacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptText: {
    ...IOSTypography.body,
    color: IOSColors.label,
    lineHeight: 22,
  },
  controlsContainer: {
    alignItems: 'center',
    paddingHorizontal: IOSSpacing.lg,
    paddingBottom: IOSSpacing.xl,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: IOSColors.systemBlue,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: IOSColors.systemBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: IOSSpacing.md,
  },
  recordingButton: {
    backgroundColor: IOSColors.systemRed,
    shadowColor: IOSColors.systemRed,
  },
  disabledButton: {
    backgroundColor: IOSColors.systemGray3,
    shadowOpacity: 0,
  },
  recordButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButtonInner: {
    backgroundColor: IOSColors.systemRed + '15',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listeningText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemRed,
    textAlign: 'center',
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: IOSSpacing.lg,
  },
  processingSpinner: {
    marginBottom: IOSSpacing.lg,
  },
  processingIcon: {
    fontSize: 32,
  },
  processingText: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
  },
  confirmationContainer: {
    alignItems: 'center',
    gap: IOSSpacing.md,
  },
  confirmButton: {
    backgroundColor: IOSColors.systemGreen,
    paddingHorizontal: IOSSpacing.xl,
    paddingVertical: IOSSpacing.md,
    borderRadius: IOSBorderRadius.xl,
    marginBottom: IOSSpacing.sm,
  },
  confirmButtonText: {
    ...IOSTypography.headline,
    color: IOSColors.systemBackground,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    paddingHorizontal: IOSSpacing.lg,
    paddingVertical: IOSSpacing.sm,
    borderRadius: IOSBorderRadius.lg,
  },
  retryButtonText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemBlue,
    fontWeight: '600',
  },
  completeContainer: {
    alignItems: 'center',
    paddingVertical: IOSSpacing.lg,
  },
  completeIcon: {
    fontSize: 48,
    marginBottom: IOSSpacing.md,
  },
  completeText: {
    ...IOSTypography.title3,
    color: IOSColors.systemGreen,
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: IOSSpacing.xl,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: IOSSpacing.lg,
  },
  permissionTitle: {
    ...IOSTypography.title2,
    color: IOSColors.label,
    marginBottom: IOSSpacing.md,
    textAlign: 'center',
  },
  permissionText: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    marginBottom: IOSSpacing.xl,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: IOSColors.systemBlue,
    paddingHorizontal: IOSSpacing.xl,
    paddingVertical: IOSSpacing.md,
    borderRadius: IOSBorderRadius.xl,
  },
  permissionButtonText: {
    ...IOSTypography.headline,
    color: IOSColors.systemBackground,
    fontWeight: '600',
  },
});

export default ConversationalVoiceAssistant;
