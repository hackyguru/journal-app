import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSBorderRadius, IOSCardStyles, IOSColors, IOSSpacing, IOSTypography, useIOSSafeAreaStyles } from './ui/ios-design-system';

interface FileUploadVoiceAssistantProps {
  selectedDate: string;
  onMemoryComplete: (memoryText: string) => void;
  onClose: () => void;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'complete';

const FileUploadVoiceAssistant: React.FC<FileUploadVoiceAssistantProps> = ({
  selectedDate,
  onMemoryComplete,
  onClose,
}) => {
  const [state, setState] = useState<RecordingState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcription, setTranscription] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const safeAreaStyles = useIOSSafeAreaStyles();

  useEffect(() => {
    requestPermissions();
    return () => {
      cleanup();
    };
  }, []);

  const requestPermissions = async () => {
    try {
      console.log('🎤 Requesting microphone permissions...');
      const { status, granted } = await Audio.requestPermissionsAsync();
      console.log('🎤 Permission result:', { status, granted });
      
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need microphone access to record your memories. Please enable microphone access in your device settings.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('✅ Microphone permission granted');
      }
    } catch (error) {
      console.error('❌ Permission request failed:', error);
      setHasPermission(false);
      Alert.alert(
        'Permission Error',
        'Failed to request microphone permission. Please check your device settings.',
        [{ text: 'OK' }]
      );
    }
  };

  const cleanup = () => {
    if (recording) {
      recording.stopAndUnloadAsync().catch(console.error);
      setRecording(null);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      await requestPermissions();
      return;
    }

    try {
      setState('recording');
      setIsRecording(true);
      setTranscription('');
      setErrorMessage('');

      // Configure recording options
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      setRecording(newRecording);

      console.log('🎤 Recording started');

    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      setState('idle');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setState('processing');
      setIsRecording(false);

      // Get the URI before stopping
      const uri = recording.getURI();
      console.log('📁 Audio file URI:', uri);

      await recording.stopAndUnloadAsync();
      setRecording(null);

      if (uri) {
        console.log('📤 Uploading audio file for transcription...');
        
        // Create FormData to send the audio file
        const formData = new FormData();
        formData.append('audio', {
          uri: uri,
          type: 'audio/wav',
          name: 'recording.wav',
        } as any);

        // Send to backend for transcription
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/transcribe-file`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Upload failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📝 Transcription result:', result);
        
        if (result.success && result.text) {
          setTranscription(result.text);
          
          // Save the transcribed text to Pinecone
          console.log('💾 Saving transcribed memory to Pinecone...');
          const saveResponse = await fetch(`${backendUrl}/api/memories`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: result.text,
              date: selectedDate,
              metadata: {
                source: 'voice_file_upload',
                confidence: result.confidence
              }
            }),
          });

          if (!saveResponse.ok) {
            const saveError = await saveResponse.json();
            throw new Error(saveError.error || `Failed to save memory: ${saveResponse.status}`);
          }

          const saveResult = await saveResponse.json();
          console.log('✅ Memory saved to Pinecone:', saveResult);
          
          setState('complete');
          
          // Notify parent component
          onMemoryComplete(result.text);
        } else {
          throw new Error(result.error || 'No transcription received');
        }
        
      } else {
        console.error('❌ No audio file URI available');
        setErrorMessage('No audio recorded. Please try again.');
        setState('idle');
      }
      
    } catch (error: any) {
      console.error('❌ Failed to process recording:', error);
      setErrorMessage(`Failed to process recording: ${error.message}`);
      setState('idle');
    }
  };

  const handleStartSession = () => {
    if (!hasPermission) {
      requestPermissions();
      return;
    }
    startRecording();
  };

  const handleRetry = () => {
    setState('idle');
    setTranscription('');
    setErrorMessage('');
  };

  const renderContent = () => {
    switch (state) {
      case 'idle':
        return (
          <View style={styles.centerContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="mic" size={64} color={IOSColors.systemBlue} />
            </View>
            <Text style={styles.title}>Voice Memory</Text>
            <Text style={styles.subtitle}>
              Tap the microphone to start recording your memory for {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
            
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        );

      case 'recording':
        return (
          <View style={styles.centerContent}>
            <View style={[styles.iconContainer, styles.recordingIcon]}>
              <Ionicons name="radio-button-on" size={64} color={IOSColors.systemRed} />
            </View>
            <Text style={styles.title}>Recording...</Text>
            <Text style={styles.subtitle}>
              Speak naturally about your memory. Tap stop when finished.
            </Text>
            <View style={styles.pulseContainer}>
              <View style={styles.pulseCircle} />
            </View>
          </View>
        );

      case 'processing':
        return (
          <View style={styles.centerContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="cloud-upload" size={64} color={IOSColors.systemBlue} />
            </View>
            <Text style={styles.title}>Processing...</Text>
            <Text style={styles.subtitle}>
              Transcribing your audio. This may take a moment.
            </Text>
          </View>
        );

      case 'complete':
        return (
          <View style={styles.centerContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle" size={64} color={IOSColors.systemGreen} />
            </View>
            <Text style={styles.title}>Memory Saved!</Text>
            <Text style={styles.subtitle}>Your voice memory has been saved successfully.</Text>
            
            {transcription && (
              <View style={styles.transcriptContainer}>
                <Text style={styles.transcriptLabel}>Transcription:</Text>
                <Text style={styles.transcriptText}>{transcription}</Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  const renderControls = () => {
    switch (state) {
      case 'idle':
        return (
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, !hasPermission && styles.disabledButton]}
              onPress={handleStartSession}
              disabled={!hasPermission}
            >
              <Ionicons name="mic" size={24} color={IOSColors.systemBackground} />
              <Text style={styles.primaryButtonText}>Start Recording</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'recording':
        return (
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: IOSColors.systemRed }]}
              onPress={stopRecording}
            >
              <Ionicons name="stop" size={24} color={IOSColors.systemBackground} />
              <Text style={styles.primaryButtonText}>Stop Recording</Text>
            </TouchableOpacity>
          </View>
        );

      case 'processing':
        return (
          <View style={styles.controlsContainer}>
            <TouchableOpacity style={[styles.primaryButton, styles.disabledButton]} disabled>
              <Text style={styles.primaryButtonText}>Processing...</Text>
            </TouchableOpacity>
          </View>
        );

      case 'complete':
        return (
          <View style={styles.controlsContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
              <Ionicons name="checkmark" size={24} color={IOSColors.systemBackground} />
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
              <Text style={styles.secondaryButtonText}>Record Another</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, safeAreaStyles.container]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={IOSColors.label} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Memory</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>

      {renderControls()}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
    backgroundColor: IOSColors.systemBackground,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOSColors.tertiarySystemFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...IOSTypography.headline,
    color: IOSColors.label,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: IOSSpacing.lg,
  },
  centerContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: IOSColors.systemBlue + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IOSSpacing.xl,
  },
  recordingIcon: {
    backgroundColor: IOSColors.systemRed + '15',
  },
  title: {
    ...IOSTypography.title1,
    color: IOSColors.label,
    textAlign: 'center',
    marginBottom: IOSSpacing.sm,
  },
  subtitle: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
  },
  pulseContainer: {
    marginTop: IOSSpacing.xl,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: IOSColors.systemRed,
    opacity: 0.6,
  },
  transcriptContainer: {
    ...IOSCardStyles.insetGrouped,
    marginTop: IOSSpacing.xl,
    width: '100%',
  },
  transcriptLabel: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    marginBottom: IOSSpacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptText: {
    ...IOSTypography.body,
    color: IOSColors.label,
    lineHeight: 22,
  },
  controlsContainer: {
    paddingHorizontal: IOSSpacing.md,
    paddingBottom: IOSSpacing.lg,
    gap: IOSSpacing.sm,
  },
  primaryButton: {
    backgroundColor: IOSColors.systemBlue,
    borderRadius: IOSBorderRadius.lg,
    paddingVertical: IOSSpacing.md,
    paddingHorizontal: IOSSpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: IOSSpacing.sm,
    minHeight: 50,
  },
  primaryButtonText: {
    ...IOSTypography.headline,
    color: IOSColors.systemBackground,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: IOSColors.tertiarySystemFill,
    borderRadius: IOSBorderRadius.lg,
    paddingVertical: IOSSpacing.md,
    paddingHorizontal: IOSSpacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryButtonText: {
    ...IOSTypography.headline,
    color: IOSColors.label,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorContainer: {
    marginTop: IOSSpacing.lg,
    padding: IOSSpacing.md,
    backgroundColor: IOSColors.systemRed + '10',
    borderRadius: IOSBorderRadius.md,
    borderWidth: 1,
    borderColor: IOSColors.systemRed + '30',
  },
  errorText: {
    ...IOSTypography.callout,
    color: IOSColors.systemRed,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
});

export default FileUploadVoiceAssistant;
