import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSBorderRadius, IOSCardStyles, IOSColors, IOSSpacing, IOSTypography, useIOSSafeAreaStyles } from './ui/ios-design-system';

interface StreamingVoiceAssistantProps {
  selectedDate: string;
  onMemoryComplete: (memoryText: string) => void;
  onClose: () => void;
}

type TranscriptionState = 'idle' | 'connecting' | 'recording' | 'processing' | 'complete';

const StreamingVoiceAssistant: React.FC<StreamingVoiceAssistantProps> = ({
  selectedDate,
  onMemoryComplete,
  onClose,
}) => {
  const [state, setState] = useState<TranscriptionState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcription, setTranscription] = useState('');
  const [partialTranscription, setPartialTranscription] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const audioChunkQueue = useRef<Blob[]>([]);
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
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    if (recording) {
      recording.stopAndUnloadAsync().catch(console.error);
      setRecording(null);
    }
  };

  const connectWebSocket = () => {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const wsUrl = backendUrl.replace('http', 'ws') + '/ws/transcribe';
    
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    console.log('🔌 Backend URL:', backendUrl);
    setState('connecting');
    setErrorMessage('');
    
    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onopen = () => {
      console.log('✅ WebSocket connected');
      // Start the transcription session
      websocketRef.current?.send(JSON.stringify({
        type: 'start',
        sampleRate: 16000
      }));
    };

    websocketRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'session_opened':
            console.log('🎯 Transcription session opened');
            startRecording();
            break;
            
          case 'transcript':
            console.log('📝 Transcript:', data.text);
            
            // With the new streaming API, we get complete turns
            const newTranscription = data.text;
            setTranscription(newTranscription);
            setPartialTranscription(''); // Clear any partial text
            
            if (data.confidence !== undefined) {
              setConfidence(data.confidence);
            }
            
            // Auto-save the transcription when we receive it
            if (newTranscription.trim() && websocketRef.current) {
              console.log('💾 Auto-saving transcription to memory...');
              websocketRef.current.send(JSON.stringify({
                type: 'save_memory',
                text: newTranscription.trim(),
                date: selectedDate
              }));
            }
            break;
            
          case 'memory_saved':
            console.log('✅ Memory saved successfully');
            setState('complete');
            // Use the current transcription state
            const finalText = transcription || data.text || '';
            console.log('📝 Final transcription for completion:', finalText);
            onMemoryComplete(finalText);
            break;
            
          case 'error':
            console.error('❌ WebSocket error:', data.error);
            setErrorMessage(data.error);
            setState('idle');
            break;
            
          case 'session_closed':
            console.log('🔚 Session closed');
            break;
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };

    websocketRef.current.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      console.error('❌ WebSocket URL was:', wsUrl);
      console.error('❌ WebSocket readyState:', websocketRef.current?.readyState);
      setErrorMessage(`Connection error: Unable to connect to ${wsUrl}. Please ensure the backend server is running.`);
      setState('idle');
    };

    websocketRef.current.onclose = () => {
      console.log('🔌 WebSocket closed');
      if (state === 'recording') {
        setState('idle');
      }
    };
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
      setPartialTranscription('');
      setErrorMessage('');

      // Configure recording options for expo-av
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

      // Start recording
      await newRecording.startAsync();
      setRecording(newRecording);

      // Check recording status
      const status = await newRecording.getStatusAsync();
      console.log('🎤 Recording started, status:', status);
      
      if (!status.canRecord) {
        throw new Error('Recording failed to start - canRecord is false');
      }

    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      setState('idle');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recording || !websocketRef.current) return;

    try {
      setState('processing');
      setIsRecording(false);

      // Check recording status before stopping and get the URI
      const statusBeforeStop = await recording.getStatusAsync();
      console.log('📊 Recording status before stop:', statusBeforeStop);
      
      // Get the URI before stopping (stopAndUnloadAsync clears the URI)
      const uri = recording.getURI();
      console.log('📁 Audio file URI (before stop):', uri);

      const result = await recording.stopAndUnloadAsync();
      console.log('🛑 Recording stopped, result:', result);

      if (uri && websocketRef.current.readyState === WebSocket.OPEN) {
        console.log('📤 Reading audio file to send to AssemblyAI...');
        
        try {
          // For React Native, we need to use a different approach to read the audio file
          // The uri from expo-av recording is a local file path
          console.log('📁 Audio file URI:', uri);
          
          // Create FormData to send the audio file to our backend
          const formData = new FormData();
          formData.append('audio', {
            uri: uri,
            type: 'audio/wav',
            name: 'recording.wav',
          } as any);
          
          // Send to our backend for processing
          const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
          const uploadResponse = await fetch(`${backendUrl}/api/transcribe-file`, {
            method: 'POST',
            body: formData,
          });
          
          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
          }
          
          const result = await uploadResponse.json();
          console.log('📝 Transcription result:', result);
          
          if (result.success && result.text) {
            // Set the transcription and auto-save
            setTranscription(result.text);
            
            // Save to memory
            websocketRef.current.send(JSON.stringify({
              type: 'save_memory',
              text: result.text.trim(),
              date: selectedDate
            }));
          } else {
            throw new Error('No transcription received');
          }
          
        } catch (audioError) {
          console.error('❌ Failed to process audio file:', audioError);
          setErrorMessage(`Failed to process recording: ${audioError.message}`);
          setState('idle');
        }
      } else if (!uri) {
        console.error('❌ No audio file URI available');
        setErrorMessage('No audio recorded. Please try again.');
        setState('idle');
      } else {
        console.error('❌ WebSocket connection lost');
        setErrorMessage('Connection lost. Please try again.');
        setState('idle');
      }
      
      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Recording Error', 'Failed to process recording. Please try again.');
      setState('idle');
    }
  };

  const handleStartSession = () => {
    if (!hasPermission) {
      requestPermissions();
      return;
    }
    connectWebSocket();
  };

  const handleSaveTranscription = () => {
    if (transcription.trim() && websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'save_memory',
        text: transcription.trim(),
        date: selectedDate
      }));
    }
  };

  const getStateMessage = () => {
    switch (state) {
      case 'idle':
        return "Ready to record your memory with real-time transcription";
      case 'connecting':
        return "Connecting to transcription service...";
      case 'recording':
        return "Listening... speak naturally about your day";
      case 'processing':
        return "Processing your memory...";
      case 'complete':
        return "Memory saved successfully!";
      default:
        return "Ready";
    }
  };

  const getStateIcon = () => {
    switch (state) {
      case 'idle':
        return '🎤';
      case 'connecting':
        return '🔌';
      case 'recording':
        return '👂';
      case 'processing':
        return '⚙️';
      case 'complete':
        return '✅';
      default:
        return '🎤';
    }
  };

  if (hasPermission === false) {
    return (
      <SafeAreaView style={[styles.container, safeAreaStyles.container]} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={IOSColors.secondaryLabel} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Voice Memory</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionIcon}>🎤</Text>
            <Text style={styles.permissionTitle}>Microphone Access Required</Text>
            <Text style={styles.permissionMessage}>
              We need access to your microphone to record your memories.
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, safeAreaStyles.container]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={IOSColors.secondaryLabel} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Streaming Voice Memory</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.statusContainer}>
          <Text style={styles.statusIcon}>{getStateIcon()}</Text>
          <Text style={styles.statusMessage}>{getStateMessage()}</Text>
          {confidence !== null && (
            <Text style={styles.confidenceText}>
              Confidence: {Math.round(confidence * 100)}%
            </Text>
          )}
        </View>

        {(transcription || partialTranscription) && (
          <View style={styles.transcriptionContainer}>
            <Text style={styles.transcriptionLabel}>Live Transcription:</Text>
            <View style={styles.transcriptionBox}>
              <Text style={styles.transcriptionText}>
                {transcription}
                {partialTranscription && (
                  <Text style={styles.partialText}> {partialTranscription}...</Text>
                )}
              </Text>
            </View>
          </View>
        )}

        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {state === 'complete' && transcription && (
          <View style={styles.completeContainer}>
            <Text style={styles.completeMessage}>Memory saved successfully!</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        {state === 'idle' && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartSession}
            disabled={!hasPermission}
          >
            <Ionicons name="mic" size={32} color={IOSColors.systemBackground} />
            <Text style={styles.startButtonText}>Start Recording</Text>
          </TouchableOpacity>
        )}

        {state === 'recording' && (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={stopRecording}
          >
            <Ionicons name="stop" size={32} color={IOSColors.systemBackground} />
            <Text style={styles.stopButtonText}>Stop & Save</Text>
          </TouchableOpacity>
        )}

        {(state === 'connecting' || state === 'processing') && (
          <View style={styles.processingIndicator}>
            <Text style={styles.processingText}>
              {state === 'connecting' ? 'Connecting...' : 'Processing...'}
            </Text>
          </View>
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
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
    backgroundColor: IOSColors.systemBackground,
  },
  closeButton: {
    padding: IOSSpacing.xs,
  },
  headerTitle: {
    ...IOSTypography.headline,
    color: IOSColors.label,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: IOSSpacing.md,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: IOSSpacing.xl,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: IOSSpacing.md,
  },
  statusMessage: {
    ...IOSTypography.title3,
    color: IOSColors.label,
    textAlign: 'center',
    marginBottom: IOSSpacing.sm,
  },
  confidenceText: {
    ...IOSTypography.caption1,
    color: IOSColors.systemGreen,
    fontWeight: '600',
  },
  transcriptionContainer: {
    ...IOSCardStyles.insetGrouped,
    width: '100%',
    marginBottom: IOSSpacing.xl,
  },
  transcriptionLabel: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: IOSSpacing.sm,
  },
  transcriptionBox: {
    backgroundColor: IOSColors.tertiarySystemFill,
    borderRadius: IOSBorderRadius.md,
    padding: IOSSpacing.md,
    minHeight: 80,
  },
  transcriptionText: {
    ...IOSTypography.body,
    color: IOSColors.label,
    lineHeight: 24,
  },
  partialText: {
    color: IOSColors.secondaryLabel,
    fontStyle: 'italic',
  },
  errorContainer: {
    ...IOSCardStyles.insetGrouped,
    width: '100%',
    backgroundColor: IOSColors.systemRed + '10',
    borderLeftWidth: 4,
    borderLeftColor: IOSColors.systemRed,
    marginBottom: IOSSpacing.md,
  },
  errorText: {
    ...IOSTypography.body,
    color: IOSColors.systemRed,
    textAlign: 'center',
  },
  completeContainer: {
    alignItems: 'center',
    marginTop: IOSSpacing.xl,
  },
  completeMessage: {
    ...IOSTypography.title3,
    color: IOSColors.systemGreen,
    marginBottom: IOSSpacing.md,
  },
  controls: {
    padding: IOSSpacing.md,
    alignItems: 'center',
    backgroundColor: IOSColors.systemBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOSColors.systemBlue,
    paddingHorizontal: IOSSpacing.xl,
    paddingVertical: IOSSpacing.md,
    borderRadius: IOSBorderRadius.full,
    shadowColor: IOSColors.systemBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startButtonText: {
    ...IOSTypography.headline,
    color: IOSColors.systemBackground,
    fontWeight: '600',
    marginLeft: IOSSpacing.sm,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOSColors.systemRed,
    paddingHorizontal: IOSSpacing.xl,
    paddingVertical: IOSSpacing.md,
    borderRadius: IOSBorderRadius.full,
    shadowColor: IOSColors.systemRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  stopButtonText: {
    ...IOSTypography.headline,
    color: IOSColors.systemBackground,
    fontWeight: '600',
    marginLeft: IOSSpacing.sm,
  },
  processingIndicator: {
    alignItems: 'center',
    padding: IOSSpacing.md,
  },
  processingText: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
  },
  permissionContainer: {
    alignItems: 'center',
    padding: IOSSpacing.xl,
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
  permissionMessage: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    marginBottom: IOSSpacing.xl,
    maxWidth: 280,
  },
  permissionButton: {
    backgroundColor: IOSColors.systemBlue,
    paddingHorizontal: IOSSpacing.xl,
    paddingVertical: IOSSpacing.md,
    borderRadius: IOSBorderRadius.md,
  },
  permissionButtonText: {
    ...IOSTypography.headline,
    color: IOSColors.systemBackground,
    fontWeight: '600',
  },
});

export default StreamingVoiceAssistant;
