import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';

// Backend API configuration
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const STORAGE_KEY = 'pinecone-memories';

// No longer needed - backend handles embeddings with proper Pinecone SDK

export const usePinecone = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeIndex = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Test connection to backend API
      console.log('Connecting to backend API:', BACKEND_URL);
      
      const response = await fetch(`${BACKEND_URL}/health`);

      if (!response.ok) {
        throw new Error(`Backend connection failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Connected to backend:', result);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to backend';
      console.error('Backend connection error:', errorMessage);
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const upsertData = useCallback(async (text: string, metadata?: Record<string, any>) => {
    try {
      setIsLoading(true);
      setError(null);

      // For daily memories, include today's date
      const requestBody: any = { text };
      
      if (metadata?.date) {
        requestBody.date = metadata.date;
      } else {
        // Default to today's date
        requestBody.date = new Date().toISOString().split('T')[0];
      }
      
      if (metadata) {
        requestBody.metadata = metadata;
      }

      // Call backend API to store memory
      const response = await fetch(`${BACKEND_URL}/api/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || `Backend request failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Memory stored via backend:', result);
      
      // Also store locally as backup
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      const existingMemories = existingData ? JSON.parse(existingData) : [];
      existingMemories.push({ 
        id: result.id, 
        text,
        date: result.date,
        timestamp: new Date().toISOString() 
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existingMemories));
      
      return { success: true, id: result.id, date: result.date };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to store memory';
      console.error('Memory storage error:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const queryData = useCallback(async (queryText: string, topK: number = 5) => {
    try {
      setIsLoading(true);
      setError(null);

      // Call backend API to search memories
      const response = await fetch(`${BACKEND_URL}/api/memories/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: queryText,
          topK,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Backend search failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Memory search result:', result);

      return { success: true, matches: result.matches };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search memories';
      console.error('Memory search error:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const askQuestion = useCallback(async (question: string, maxMemories: number = 5) => {
    try {
      setIsLoading(true);
      setError(null);

      // Call backend API for conversational chat
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          maxMemories,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Chat request failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Chat result:', result);

      return { 
        success: true, 
        answer: result.answer, 
        memoriesUsed: result.memoriesUsed,
        memories: result.memories,
        fallback: result.fallback || false
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process question';
      console.error('Chat error:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);


  const getWeekMemories = useCallback(async (startDate: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Call backend API to get week memories
      const response = await fetch(`${BACKEND_URL}/api/memories/week?startDate=${startDate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Backend request failed: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, memories: result.memories, weekStart: result.weekStart };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get week memories';
      console.error('Week memories error:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    initializeIndex,
    upsertData,
    queryData,
    askQuestion,
    getWeekMemories,
  };
};