import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IOSBorderRadius, IOSButtonStyles, IOSButtonTextStyles, IOSCardStyles, IOSColors, IOSSpacing, IOSTypography } from './ui/ios-design-system';

interface VoiceRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

// Declare global SpeechRecognition interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  onTranscriptionComplete, 
  onError,
  disabled = false 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null);

  // Setup Speech Recognition
  useEffect(() => {
    initializeSpeechRecognition();

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  const initializeSpeechRecognition = async () => {
    try {
      // Request microphone permissions for audio recording
      const { status } = await Audio.requestPermissionsAsync();
      console.log('Microphone permission status:', status);
      
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'This app needs microphone permission to record your voice.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      setHasPermission(false);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Microphone permission is required.');
      return;
    }

    if (isRecording) {
      console.log('Recording already in progress');
      return;
    }

    try {
      setRecordingDuration(0);
      setAudioLevel(0);
      setIsRecording(true);

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording with optimized settings for transcription
      const { recording: newRecording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000, // Optimal for speech recognition
          numberOfChannels: 1, // Mono
          bitRate: 64000, // Lower bitrate for smaller files
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 16000, // Optimal for speech recognition
          numberOfChannels: 1, // Mono
          bitRate: 64000, // Lower bitrate for smaller files
        },
      });
      
      setRecording(newRecording);

      // Start duration counter
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start pulse animation
      startPulseAnimation();

      // Monitor audio levels (simulated for visual feedback)
      audioLevelInterval.current = setInterval(() => {
        setAudioLevel(Math.random() * 100);
      }, 200);

      console.log('Audio recording started - will transcribe when stopped');

    } catch (error) {
      console.error('Failed to start recording:', error);
      onError('Failed to start voice recording. Please try again.');
      resetRecorder();
    }
  };

  const stopRecording = async () => {
    if (!isRecording || !recording) return;

    try {
      setIsProcessing(true);

      // Stop duration counter and audio level monitoring
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      
      if (audioLevelInterval.current) {
        clearInterval(audioLevelInterval.current);
        audioLevelInterval.current = null;
      }

      // Stop pulse animation
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);

      console.log('Stopping audio recording and generating transcription...');

      // Stop the recording
      const uri = recording.getURI();
      
      try {
        await recording.stopAndUnloadAsync();
      } catch (unloadError) {
        console.log('Recording already unloaded:', unloadError);
      }
      
      setRecording(null);

      // Transcribe with AssemblyAI
      if (uri) {
        await transcribeWithAssemblyAI(uri);
      } else {
        onError('No audio recorded');
        resetRecorder();
      }

    } catch (error) {
      console.error('Failed to stop recording:', error);
      onError('Failed to process recording. Please try again.');
      resetRecorder();
    }
  };


  const transcribeWithAssemblyAI = async (audioUri: string) => {
    try {
      console.log('🎤 Starting real AssemblyAI transcription...', { audioUri, duration: recordingDuration });

      // Read the audio file and convert to base64
      const response = await fetch(audioUri);
      const audioBlob = await response.blob();
      
      console.log('📁 Audio file info:', { 
        size: audioBlob.size, 
        type: audioBlob.type,
        sizeInMB: (audioBlob.size / 1024 / 1024).toFixed(2)
      });
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          if (base64String) {
            // Remove the data:audio/m4a;base64, prefix
            const base64Data = base64String.split(',')[1];
            console.log('📊 Base64 audio size:', (base64Data.length * 0.75 / 1024 / 1024).toFixed(2), 'MB');
            resolve(base64Data);
          } else {
            reject(new Error('Failed to convert audio to base64'));
          }
        };
        reader.onerror = () => reject(new Error('FileReader error'));
      });

      // Send to backend for AssemblyAI transcription
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      console.log('🔄 Sending to backend:', backendUrl);
      
      const transcriptionResponse = await fetch(`${backendUrl}/api/transcribe-assemblyai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: base64Audio,
          audioFormat: 'm4a'
        }),
      });

      console.log('📡 Backend response status:', transcriptionResponse.status);

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error('Backend error response:', errorText);
        throw new Error(`Backend transcription failed: ${transcriptionResponse.status} - ${errorText}`);
      }

      const transcriptionResult = await transcriptionResponse.json();
      console.log('📝 Transcription result:', transcriptionResult);
      
      if (transcriptionResult.success && transcriptionResult.transcription) {
        const transcription = transcriptionResult.transcription.trim();
        if (transcription && transcription.length > 0) {
          console.log('✅ Real AssemblyAI transcription:', transcription);
          onTranscriptionComplete(transcription);
        } else {
          throw new Error('Empty transcription result');
        }
      } else {
        throw new Error(transcriptionResult.error || 'Transcription returned no text');
      }

    } catch (error) {
      console.error('❌ AssemblyAI transcription error:', error);
      
      // Show error to user instead of fake fallback
      onError(`Voice transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try speaking more clearly or check your internet connection.`);
    }
    
    resetRecorder();
  };

  const startPulseAnimation = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        ]).start(() => {
        if (isRecording) pulse();
      });
    };
    pulse();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetRecorder = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current);
      audioLevelInterval.current = null;
    }
    
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    
    setIsRecording(false);
    setIsProcessing(false);
    setRecordingDuration(0);
    setAudioLevel(0);
    setRecording(null);
  };

  const handleRecordPress = () => {
    if (disabled || isProcessing) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting microphone permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Microphone access denied</Text>
        <TouchableOpacity 
          style={[IOSButtonStyles.secondary, styles.retryButton]}
          onPress={initializeSpeechRecognition}
        >
          <Text style={IOSButtonTextStyles.secondary}>Retry Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Recording Status */}
      {(isRecording || isProcessing) && (
        <View style={[IOSCardStyles.grouped, styles.statusContainer]}>
          <Text style={styles.statusText}>
            {isProcessing 
              ? 'Converting speech to text with AssemblyAI...' 
              : `Recording ${formatDuration(recordingDuration)}`
            }
          </Text>
          {isRecording && (
            <View style={styles.audioLevelContainer}>
              <View style={[styles.audioLevelBar, { width: `${Math.min(audioLevel, 100)}%` }]} />
            </View>
          )}
        </View>
      )}

      {/* Record Button */}
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordingButton,
          disabled && styles.disabledButton
        ]}
        onPress={handleRecordPress}
        disabled={disabled || isProcessing}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.recordButtonInner,
            isRecording && styles.recordingButtonInner,
            { transform: [{ scale: isRecording ? pulseAnim : 1 }] }
          ]}
        >
          <Ionicons 
            name={isProcessing ? 'hourglass' : isRecording ? 'stop' : 'mic'} 
            size={28} 
            color={isRecording ? IOSColors.systemRed : IOSColors.systemBlue} 
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Instructions */}
      <Text style={styles.instructionText}>
        {isProcessing 
          ? 'Converting your speech to text...'
          : isRecording
            ? 'Speak clearly, then tap to stop'
            : 'Tap to start recording your voice'
        }
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: IOSSpacing.lg,
  },
  statusContainer: {
    backgroundColor: IOSColors.systemBlue + '15', // 15% opacity
    borderRadius: IOSBorderRadius.full,
    paddingHorizontal: IOSSpacing.md,
    paddingVertical: IOSSpacing.sm,
    marginBottom: IOSSpacing.md,
  },
  statusText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemBlue,
    fontWeight: '600',
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
    shadowOpacity: 0.1,
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: IOSColors.systemBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButtonInner: {
    backgroundColor: IOSColors.systemRed + '15', // 15% opacity
  },
  recordIcon: {
    fontSize: 24,
  },
  recordingIcon: {
    fontSize: 20,
  },
  instructionText: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    maxWidth: 200,
  },
  audioLevelContainer: {
    width: 200,
    height: 4,
    backgroundColor: IOSColors.systemGray5,
    borderRadius: 2,
    marginTop: IOSSpacing.sm,
    overflow: 'hidden',
  },
  audioLevelBar: {
    height: '100%',
    backgroundColor: IOSColors.systemBlue,
    borderRadius: 2,
  },
  permissionText: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    marginBottom: IOSSpacing.md,
  },
  retryButton: {
    minWidth: 140,
  },
  partialText: {
    ...IOSTypography.subhead,
    color: IOSColors.systemBlue,
    fontStyle: 'italic',
    marginTop: IOSSpacing.sm,
    textAlign: 'center',
  },
});

export default VoiceRecorder;
