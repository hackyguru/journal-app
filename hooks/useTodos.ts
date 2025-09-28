import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useState } from 'react';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  category: string;
  sourceMemoryId?: string;
  sourceMemoryDate?: string;
  sourceMemoryText?: string;
  createdAt: string;
  completedAt?: string;
  userId: string;
}

export const useTodos = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const refreshTodos = useCallback(async () => {
    if (!user?.id) {
      setError('User must be authenticated');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${BACKEND_URL}/api/todos?userId=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch todos: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setTodos(result.todos || []);
      } else {
        throw new Error(result.error || 'Failed to fetch todos');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch todos';
      console.error('Error fetching todos:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const toggleTodoComplete = useCallback(async (todoId: string, completed: boolean) => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      setError(null);

      const response = await fetch(`${BACKEND_URL}/api/todos/${todoId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          completed: completed
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update todo: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update todo');
      }

      // Update local state optimistically
      setTodos(prevTodos => 
        prevTodos.map(todo => 
          todo.id === todoId 
            ? { ...todo, completed: completed, completedAt: completed ? new Date().toISOString() : undefined }
            : todo
        )
      );

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update todo';
      console.error('Error updating todo:', errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, [user?.id]);

  const extractTodosFromMemories = useCallback(async () => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      setError(null);

      console.log('🤖 Extracting todos from memories...');
      
      const response = await fetch(`${BACKEND_URL}/api/todos/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to extract todos: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Extracted ${result.newTodosCount} new todos`);
        return {
          success: true,
          newTodosCount: result.newTodosCount,
          totalTodosCount: result.totalTodosCount,
          skippedMemoriesCount: result.skippedMemoriesCount
        };
      } else {
        throw new Error(result.error || 'Failed to extract todos');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract todos';
      console.error('Error extracting todos:', errorMessage);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [user?.id]);

  return {
    todos,
    isLoading,
    error,
    refreshTodos,
    toggleTodoComplete,
    extractTodosFromMemories,
  };
};
