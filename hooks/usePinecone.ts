import { useAuth } from '@/contexts/AuthContext';
import { getTodayLocalDate } from '@/utils/dateUtils';
import { useCallback, useState } from 'react';

// Backend API configuration
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export const usePinecone = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

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

      // Ensure user is authenticated
      if (!user?.id) {
        throw new Error('User must be authenticated to save memories');
      }

      // For daily memories, include today's date and userId
      const requestBody: any = { 
        text,
        userId: user.id  // 🔑 Include user ID for isolation
      };
      
      if (metadata?.date) {
        requestBody.date = metadata.date;
      } else {
        // Default to today's date
        requestBody.date = getTodayLocalDate();
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
      
      return { 
        success: true, 
        id: result.id, 
        date: result.date,
        title: result.title // Include AI-generated title from backend
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to store memory';
      console.error('Memory storage error:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const queryData = useCallback(async (queryText: string, topK: number = 5) => {
    try {
      setIsLoading(true);
      setError(null);

      // Ensure user is authenticated
      if (!user?.id) {
        throw new Error('User must be authenticated to search memories');
      }

      // Call backend API to search memories
      const response = await fetch(`${BACKEND_URL}/api/memories/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: queryText,
          maxResults: topK,
          userId: user.id  // 🔑 Include user ID for isolation
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
  }, [user]);

  const askQuestion = useCallback(async (
    question: string, 
    maxMemories: number = 5, 
    dateRange?: { startDate?: string; endDate?: string }
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      // Ensure user is authenticated
      if (!user?.id) {
        throw new Error('User must be authenticated to ask questions');
      }

      // Call backend API for conversational chat
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          maxMemories,
          userId: user.id,  // 🔑 Include user ID for isolation
          startDate: dateRange?.startDate,  // 📅 Include date range filtering
          endDate: dateRange?.endDate
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
  }, [user]);


  const getWeekMemories = useCallback(async (startDate: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Ensure user is authenticated
      if (!user?.id) {
        throw new Error('User must be authenticated to get memories');
      }

      // Call backend API to get week memories
      const url = `${BACKEND_URL}/api/memories/week?startDate=${startDate}&userId=${user.id}`;
      console.log('🌐 Fetching from URL:', url);
      const response = await fetch(url, {
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
  }, [user]);

  const deleteMemory = useCallback(async (memoryId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!user?.id) {
        throw new Error('User must be authenticated to delete memories');
      }

      console.log('🗑️ Deleting memory:', memoryId);

      const response = await fetch(`${BACKEND_URL}/api/memories/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete memory: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Memory deleted successfully');
        return { success: true, message: result.message };
      } else {
        throw new Error(result.error || 'Failed to delete memory');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete memory';
      console.error('Delete memory error:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateMemory = useCallback(async (memoryId: string, text: string, title?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!user?.id) {
        throw new Error('User must be authenticated to update memories');
      }

      console.log('📝 Updating memory:', memoryId);

      const response = await fetch(`${BACKEND_URL}/api/memories/${memoryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          title,
          userId: user.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update memory: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Memory updated successfully');
        return { success: true, title: result.title, message: result.message };
      } else {
        throw new Error(result.error || 'Failed to update memory');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update memory';
      console.error('Update memory error:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isLoading,
    error,
    initializeIndex,
    upsertData,
    queryData,
    askQuestion,
    getWeekMemories,
    deleteMemory,
    updateMemory,
  };
};