import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSCardStyles, IOSColors, IOSSpacing, IOSTypography, useIOSSafeAreaStyles } from './ui/ios-design-system';

interface ConversationalAssistantProps {
  selectedDate: string;
  onMemoryComplete: (memoryText: string) => void;
  onClose: () => void;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const ConversationalAssistant: React.FC<ConversationalAssistantProps> = ({
  selectedDate,
  onMemoryComplete,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<'greeting' | 'exploring' | 'deepening' | 'concluding'>('greeting');
  const [userResponses, setUserResponses] = useState<string[]>([]);

  const scrollViewRef = useRef<ScrollView>(null);
  const safeAreaStyles = useIOSSafeAreaStyles();

  // Conversation prompts based on phase
  const conversationPrompts = {
    greeting: [
      "Hi there! I'm here to help you reflect on your day. How are you feeling right now?",
      "Hello! I'd love to hear about your day. What's the first thing that comes to mind?",
      "Hey! Let's talk about your day. What stood out to you today?",
    ],
    exploring: [
      "That's interesting! Can you tell me more about that?",
      "How did that make you feel?",
      "What was going through your mind when that happened?",
      "That sounds significant. What did you learn from that experience?",
      "Was there anything surprising about that situation?",
    ],
    deepening: [
      "What was the most meaningful part of your day?",
      "Is there anything you're grateful for today?",
      "What would you do differently if you could?",
      "How do you think today's experiences will influence you going forward?",
      "What emotions are you carrying from today?",
    ],
    concluding: [
      "Thank you for sharing. Is there anything else important about today you'd like to remember?",
      "What's one key takeaway from our conversation about your day?",
      "How are you feeling now after reflecting on your day?",
    ],
  };

  useEffect(() => {
    startConversation();
  }, []);

  const startConversation = () => {
    const greeting = conversationPrompts.greeting[Math.floor(Math.random() * conversationPrompts.greeting.length)];
    addMessage(greeting, false);
  };

  const addMessage = (text: string, isUser: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const getNextPrompt = () => {
    const responseCount = userResponses.length;
    
    if (responseCount === 0) {
      setConversationPhase('exploring');
      return conversationPrompts.exploring[Math.floor(Math.random() * conversationPrompts.exploring.length)];
    } else if (responseCount < 3) {
      if (Math.random() > 0.5) {
        return conversationPrompts.exploring[Math.floor(Math.random() * conversationPrompts.exploring.length)];
      } else {
        setConversationPhase('deepening');
        return conversationPrompts.deepening[Math.floor(Math.random() * conversationPrompts.deepening.length)];
      }
    } else if (responseCount < 5) {
      setConversationPhase('deepening');
      return conversationPrompts.deepening[Math.floor(Math.random() * conversationPrompts.deepening.length)];
    } else {
      setConversationPhase('concluding');
      return conversationPrompts.concluding[Math.floor(Math.random() * conversationPrompts.concluding.length)];
    }
  };


  const finishConversation = () => {
    const finalMessage = "Thank you for sharing your day with me. I'll save these reflections to your memory.";
    addMessage(finalMessage, false);

    // Combine all user responses into a cohesive memory
    const memoryText = userResponses.join(' ');
    
    setTimeout(() => {
      onMemoryComplete(memoryText);
    }, 2000);
  };



  const generateContextualMockResponse = async () => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate responses that make sense in the conversation flow
    const contextualResponses = {
      greeting: [
        "I'm feeling pretty good today, thanks for asking. There were definitely some highlights.",
        "I'm doing well overall. Today had its ups and downs but I'm feeling reflective about it.",
        "I'm feeling grateful actually. Today reminded me of some important things in my life.",
        "I'm a bit tired but satisfied with how things went. It was quite an eventful day.",
      ],
      exploring: [
        "Well, I had this really meaningful conversation with someone close to me that made me think differently about things.",
        "I accomplished something today that I've been working towards for a while, and it felt really rewarding.",
        "I spent some time in nature and it was so peaceful. It really helped me gain some perspective.",
        "I learned something new about myself today through a challenging situation I had to navigate.",
        "I connected with an old friend and we shared some wonderful memories that brought me joy.",
      ],
      deepening: [
        "The most meaningful part was probably realizing how much I've grown as a person this year.",
        "I'm really grateful for the people in my life who support me through both good times and challenges.",
        "I think what I'd do differently is be more present in the moment instead of worrying about the future.",
        "Today's experiences reminded me that it's okay to be vulnerable and ask for help when I need it.",
        "I'm carrying a sense of hope and excitement about the possibilities that lie ahead.",
      ],
      concluding: [
        "I think the key takeaway is that even ordinary days can have extraordinary moments if you pay attention.",
        "I'm feeling more centered and grateful after reflecting on everything that happened today.",
        "I want to remember to celebrate the small victories and be kinder to myself when things don't go as planned.",
        "Today reinforced that the relationships in my life are what matter most, and I should nurture them more.",
      ],
    };

    const responses = contextualResponses[conversationPhase];
    return responses[Math.floor(Math.random() * responses.length)];
  };


  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };



  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, safeAreaStyles.safeAreaHorizontal]}>
        <Text style={styles.headerTitle}>Daily Reflection Assistant</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={IOSColors.secondaryLabel} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message) => (
          <View key={message.id} style={[
            IOSCardStyles.grouped,
            styles.messageBubble,
            message.isUser ? styles.userMessage : styles.assistantMessage
          ]}>
            <Text style={[
              styles.messageText,
              message.isUser ? styles.userMessageText : styles.assistantMessageText
            ]}>
              {message.text}
            </Text>
            <Text style={styles.messageTime}>
              {formatTime(message.timestamp)}
            </Text>
          </View>
        ))}
        
        {isWaitingForResponse && (
          <View style={[styles.messageBubble, styles.assistantMessage]}>
            <Text style={styles.processingText}>Processing your response...</Text>
          </View>
        )}
      </ScrollView>

      {/* Text Input for Conversation */}
      <View style={styles.controlsContainer}>
        <Text style={styles.instructionText}>
          Voice recording has been moved to the main "Record" option for better streaming experience.
        </Text>
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
  closeButtonText: {
    ...IOSTypography.title2,
    color: IOSColors.secondaryLabel,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: IOSSpacing.md,
  },
  messagesContent: {
    paddingVertical: IOSSpacing.md,
  },
  messageBubble: {
    maxWidth: '80%',
    marginBottom: IOSSpacing.md,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: IOSColors.systemBlue,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: IOSColors.systemBackground,
  },
  messageText: {
    ...IOSTypography.body,
    marginBottom: IOSSpacing.xs,
  },
  userMessageText: {
    color: IOSColors.systemBackground,
  },
  assistantMessageText: {
    color: IOSColors.label,
  },
  messageTime: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    textAlign: 'right',
  },
  processingText: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    fontStyle: 'italic',
  },
  controlsContainer: {
    backgroundColor: IOSColors.systemBackground,
    paddingHorizontal: IOSSpacing.lg,
    paddingVertical: IOSSpacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: IOSColors.systemBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IOSSpacing.md,
    shadowColor: IOSColors.systemBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordingButton: {
    backgroundColor: IOSColors.systemRed,
  },
  recordButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonText: {
    fontSize: 32,
  },
  instructionText: {
    ...IOSTypography.subhead,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    maxWidth: 250,
  },
  processingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: IOSSpacing.lg,
  },
  processingLabel: {
    ...IOSTypography.subhead,
    color: IOSColors.systemBlue,
    textAlign: 'center',
  },
  loadingText: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    marginTop: IOSSpacing.xl,
  },
  errorText: {
    ...IOSTypography.body,
    color: IOSColors.systemRed,
    textAlign: 'center',
    marginBottom: IOSSpacing.lg,
  },
  instructionText: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ConversationalAssistant;
