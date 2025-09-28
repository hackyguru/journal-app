const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const { AssemblyAI } = require('assemblyai');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase payload limit for audio files
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  },
});

// Initialize Pinecone
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

// Initialize OpenAI (with graceful handling for missing API key)
let openai = null;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (openaiApiKey) {
  openai = new OpenAI({
    apiKey: openaiApiKey
  });
  console.log('✅ OpenAI API key found - conversational chat enabled');
} else {
  console.log('⚠️  OpenAI API key not found in .env file');
  console.log('   Add OPENAI_API_KEY=your_key_here to enable conversational chat');
}

// Initialize AssemblyAI (with graceful handling for missing API key)
let assemblyai = null;
const assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY;

if (assemblyaiApiKey) {
  assemblyai = new AssemblyAI({
    apiKey: assemblyaiApiKey
  });
  console.log('✅ AssemblyAI API key found - real-time transcription enabled');
} else {
  console.log('⚠️  AssemblyAI API key not found in .env file');
  console.log('   Add ASSEMBLYAI_API_KEY=your_key_here to enable real-time transcription');
}

const indexName = 'developer-quickstart-js';

// Simple fallback response when OpenAI is unavailable
function generateLocalResponse(question, memories) {
  if (!memories || memories.length === 0) {
    return "I couldn't find any relevant memories to answer your question. Try asking about something you've written in your daily memories.";
  }
  
  const count = memories.length;
  const firstMemory = memories[0];
  
  return `I found ${count} relevant memor${count === 1 ? 'y' : 'ies'}. Here's the most relevant one: ${firstMemory}${count > 1 ? ` (${count - 1} more found)` : ''}`;
}

// Generate a concise title for a memory
async function generateMemoryTitle(memoryText) {
  // Fallback title generation (when OpenAI is not available)
  const generateFallbackTitle = (text) => {
    // Remove extra whitespace and get first sentence or 50 characters
    const cleaned = text.trim().replace(/\s+/g, ' ');
    
    // Try to get first sentence
    const firstSentence = cleaned.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length <= 50 && firstSentence.length >= 10) {
      return firstSentence.trim();
    }
    
    // Fallback to first 50 characters with smart truncation
    if (cleaned.length <= 50) {
      return cleaned;
    }
    
    // Find last complete word within 47 characters (leaving room for "...")
    const truncated = cleaned.substring(0, 47);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > 20) { // Ensure we have a reasonable amount of text
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  };

  // If OpenAI is not available, use fallback
  if (!openai) {
    return generateFallbackTitle(memoryText);
  }

  try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Create a factual title (max 50 characters) for this personal memory. ONLY use information explicitly mentioned in the text. Do NOT add details, locations, or context not present in the original text. Be conservative and stick to the facts. If the memory is vague, keep the title vague too.'
          },
          {
            role: 'user',
            content: `Memory: "${memoryText}"`
          }
        ],
        max_tokens: 15, // Reduced to encourage shorter, more factual titles
        temperature: 0.1 // Much lower temperature for more conservative responses
      });

    const aiTitle = response.choices[0].message.content.trim();
    
    // Validate AI title and use fallback if needed
    if (aiTitle && aiTitle.length <= 50 && aiTitle.length >= 5) {
      return aiTitle;
    } else {
      return generateFallbackTitle(memoryText);
    }
  } catch (error) {
    console.error('Error generating AI title:', error);
    return generateFallbackTitle(memoryText);
  }
}

// Initialize index (create if doesn't exist)
async function initializeIndex() {
  try {
    const existingIndexes = await pc.listIndexes();
    const indexExists = existingIndexes.indexes?.some(index => index.name === indexName);

    if (!indexExists) {
      await pc.createIndexForModel({
        name: indexName,
        cloud: 'aws',
        region: 'us-east-1',
        embed: {
          model: 'llama-text-embed-v2',
          fieldMap: { text: 'chunk_text' },
        },
        waitUntilReady: true,
      });
    }
    return true;
  } catch (error) {
    console.error('Error initializing index:', error);
    return false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', message: 'Pinecone Memory API is running' });
});

// Function to analyze text sentiment using OpenAI
const analyzeTextSentiment = async (text) => {
  if (!openai) {
    return { sentiment: 'NEUTRAL', confidence: 0 };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a sentiment analysis expert. Analyze the sentiment of the given text and respond with ONLY a JSON object containing "sentiment" (POSITIVE, NEGATIVE, or NEUTRAL) and "confidence" (0-1 score). No other text.'
        },
        {
          role: 'user',
          content: `Analyze the sentiment of this text: "${text}"`
        }
      ],
      max_tokens: 50,
      temperature: 0
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      sentiment: result.sentiment || 'NEUTRAL',
      confidence: result.confidence || 0
    };
  } catch (error) {
    console.error('❌ OpenAI sentiment analysis error:', error);
    return { sentiment: 'NEUTRAL', confidence: 0 };
  }
};

// Store memory endpoint
app.post('/api/memories', async (req, res) => {
  try {
    const { text, date, metadata = {}, sentiment, sentimentConfidence, userId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Validate date format and ensure it's today
    const isValidDateFormat = (dateStr) => {
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      return regex.test(dateStr);
    };

    const getTodayLocalDate = () => {
      const today = new Date();
      return today.getFullYear() + '-' + 
        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
        String(today.getDate()).padStart(2, '0');
    };

    if (!isValidDateFormat(date)) {
      return res.status(400).json({ 
        error: 'Invalid date format',
        message: 'Date must be in YYYY-MM-DD format'
      });
    }

    const todayStr = getTodayLocalDate();
    
    if (date !== todayStr) {
      return res.status(400).json({ 
        error: 'Can only create memories for today',
        message: `You can only add memories for the current day (${todayStr}). Received: ${date}`
      });
    }

    const index = pc.index(indexName);
    const dateStr = date; // Already in YYYY-MM-DD format
    
    // Check how many memories exist for this date and user (max 5 allowed)
    const namespace = index.namespace('default');
    const existingQuery = await namespace.query({
      topK: 100,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
      filter: {
        userId: userId  // Filter by user ID
      }
    });

    const existingMemories = existingQuery.matches?.filter(match => {
      const memoryDate = match.date || match.metadata?.date;
      const memoryUserId = match.userId || match.metadata?.userId;
      return memoryDate === dateStr && memoryUserId === userId;
    }) || [];


    if (existingMemories.length >= 5) {
      return res.status(400).json({
        error: 'Maximum memories reached for this date',
        message: 'You can only store up to 5 memories per day. Please edit or delete an existing memory.',
        existingMemories: existingMemories.map(memory => ({
          id: memory.id,
          text: memory.metadata?.text || '',
          date: memory.metadata?.date
        }))
      });
    }

    const id = `memory-${dateStr}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate title for the memory
    const memoryTitle = await generateMemoryTitle(text);
    
    // Analyze sentiment if not provided (for text memories)
    let finalSentiment = sentiment || 'NEUTRAL';
    let finalSentimentConfidence = sentimentConfidence || 0;
    
    if (!sentiment && metadata.source !== 'voice_file_upload') {
      const sentimentResult = await analyzeTextSentiment(text);
      finalSentiment = sentimentResult.sentiment;
      finalSentimentConfidence = sentimentResult.confidence;
    }
    
    // Upsert with integrated embeddings including date, sentiment, and title
    await namespace.upsertRecords([
      {
        _id: id,
        text: text, // This field matches the fieldMap configuration
        title: memoryTitle,                  // 📝 Store generated title
        date: dateStr,
        timestamp: new Date().toISOString(),
        source: metadata.source || 'daily_memory',
        weekday: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
        sentiment: finalSentiment,           // 🎭 Store sentiment: POSITIVE, NEGATIVE, NEUTRAL
        sentimentConfidence: finalSentimentConfidence, // 🎭 Store confidence score
        userId: userId,                      // 🔑 Store user ID for multi-user support
        ...metadata,
      },
    ]);


    res.json({
      success: true,
      id,
      title: memoryTitle,
      date: dateStr,
      message: 'Daily memory stored successfully'
    });

  } catch (error) {
    console.error('Error storing memory:', error);
    res.status(500).json({
      error: 'Failed to store memory',
      details: error.message
    });
  }
});

// Search memories endpoint
app.post('/api/memories/search', async (req, res) => {
  try {
    const { query, topK = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const index = pc.index(indexName);
    const namespace = index.namespace('default');

    // For integrated embeddings, we need to create a temporary record with the query text
    // and let Pinecone generate its embedding, then use that for similarity search
    
    // First, create a temporary record to get the query embedding
    const tempId = `temp-query-${Date.now()}`;
    
    try {
      // Upsert the query text to get its embedding
      await namespace.upsertRecords([
        {
          _id: tempId,
          text: query,
          temp: true, // Mark as temporary
        },
      ]);

      // Small delay to ensure the record is indexed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now query using the temporary record's embedding
      // We'll get all records and then filter out the temporary one
      const queryResponse = await namespace.query({
        id: tempId, // Use the temporary record as the query vector
        topK: topK + 1, // Get one extra to account for the temp record
        includeMetadata: true,
        includeValues: false,
      });

      // Clean up the temporary record
      await namespace.deleteOne(tempId);

      // Filter out the temporary record and format results
      // Advanced filtering with dynamic thresholds and relevance scoring
      const allMatches = queryResponse.matches
        ?.filter(match => match.id !== tempId) || []; // Remove the temporary query record
      
      let matches = [];
      
      if (allMatches.length > 0) {
        // Calculate dynamic threshold based on score distribution
        const scores = allMatches.map(m => m.score);
        const maxScore = Math.max(...scores);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        // Dynamic threshold: use 25% of max score or 0.02, whichever is higher
        const dynamicThreshold = Math.max(maxScore * 0.25, 0.02);
        
        
        matches = allMatches
          .filter(match => match.score >= dynamicThreshold) // Use dynamic threshold
          .map(match => ({
            id: match.id,
            score: match.score,
            metadata: {
              chunk_text: match.metadata?.text || '',
              timestamp: match.metadata?.timestamp || '',
              source: match.metadata?.source || 'unknown',
            },
          }))
          .slice(0, topK); // Ensure we return only the requested number
      }


      res.json({
        success: true,
        matches,
        query
      });

    } catch (tempError) {
      console.error('Error in semantic search:', tempError);
      // Fallback to simple text matching if semantic search fails
      const queryResponse = await namespace.query({
        topK: 100,
        includeMetadata: true,
        includeValues: false,
        vector: new Array(1024).fill(0.001),
      });

      const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 0);
      const matches = queryResponse.matches
        ?.map(match => {
          const text = (match.metadata?.text || '').toLowerCase();
          let relevanceScore = 0;
          
          queryWords.forEach(word => {
            if (text.includes(word)) {
              relevanceScore += 1;
            }
          });
          
          return {
            id: match.id,
            score: relevanceScore / queryWords.length,
            metadata: {
              chunk_text: match.metadata?.text || '',
              timestamp: match.metadata?.timestamp || '',
              source: match.metadata?.source || 'unknown',
            },
          };
        })
        .filter(match => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK) || [];

      console.log('Fallback search completed:', { query, resultsCount: matches.length });

      res.json({
        success: true,
        matches,
        query
      });
    }

  } catch (error) {
    console.error('Error searching memories:', error);
    res.status(500).json({
      error: 'Failed to search memories',
      details: error.message
    });
  }
});

// Get index stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const index = pc.index(indexName);
    const stats = await index.describeIndexStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: 'Failed to get index stats',
      details: error.message
    });
  }
});

// Delete all memories endpoint (for cleanup)
app.delete('/api/memories/all', async (req, res) => {
  try {
    const index = pc.index(indexName);
    
    // Delete from default namespace
    const defaultNamespace = index.namespace('default');
    await defaultNamespace.deleteAll();
    
    // Delete from unnamed namespace (if any)
    try {
      await index.deleteAll();
    } catch (err) {
      console.log('No unnamed namespace to clear:', err.message);
    }
    
    console.log('All memories deleted from index');
    
    res.json({
      success: true,
      message: 'All memories have been deleted'
    });
  } catch (error) {
    console.error('Error deleting memories:', error);
    res.status(500).json({
      error: 'Failed to delete memories',
      details: error.message
    });
  }
});

// Conversational RAG endpoint - Ask questions about your memories
app.post('/api/chat', async (req, res) => {
  try {
    const { question, maxMemories = 5, userId, startDate, endDate } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if OpenAI is available
    if (!openai) {
      return res.status(503).json({ 
        error: 'OpenAI API key not configured', 
        message: 'Please add OPENAI_API_KEY to your .env file to enable conversational chat',
        suggestion: 'You can still use /api/memories/search for basic memory retrieval'
      });
    }

    console.log(`💬 User question: "${question}"`);

    // Step 1: Search relevant memories using our RAG system
    const index = pc.index(indexName);
    const namespace = index.namespace('default');

    // Create temporary record for semantic search
    const tempId = `temp-chat-${Date.now()}`;
    
    try {
      // Upsert the question to get its embedding
      await namespace.upsertRecords([
        {
          _id: tempId,
          text: question,
          temp: true,
        },
      ]);

      // Small delay for indexing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Build filter for user and optional date range
      const filter = { userId: userId };
      
      // Query for relevant memories with user filtering
      const queryResponse = await namespace.query({
        id: tempId,
        topK: 100, // Get more results to filter by date range
        includeMetadata: true,
        includeValues: false,
        filter: filter
      });

      // Clean up temp record
      await namespace.deleteOne(tempId);

      // Filter and format relevant memories
      let allMatches = queryResponse.matches?.filter(match => match.id !== tempId) || [];
      
      // Apply date range filtering if specified
      if (startDate || endDate) {
        allMatches = allMatches.filter(match => {
          const memoryDate = match.date || match.metadata?.date;
          if (!memoryDate) return false;
          
          // Check if memory date is within the specified range
          if (startDate && memoryDate < startDate) return false;
          if (endDate && memoryDate > endDate) return false;
          
          return true;
        });
      }
      
      let relevantMemories = [];
      if (allMatches.length > 0) {
        const scores = allMatches.map(m => m.score);
        const maxScore = Math.max(...scores);
        const dynamicThreshold = Math.max(maxScore * 0.25, 0.02);
        
        relevantMemories = allMatches
          .filter(match => match.score >= dynamicThreshold)
          .map(match => match.metadata?.text || match.text || '')
          .filter(text => text.length > 0)
          .slice(0, maxMemories);
      }

      // Build date range context for the AI
      let dateRangeContext = '';
      if (startDate && endDate) {
        dateRangeContext = `\n\nNote: The user is asking about memories from ${startDate} to ${endDate}.`;
      } else if (startDate) {
        dateRangeContext = `\n\nNote: The user is asking about memories from ${startDate} onwards.`;
      } else if (endDate) {
        dateRangeContext = `\n\nNote: The user is asking about memories up to ${endDate}.`;
      }

      console.log(`🔍 Found ${relevantMemories.length} relevant memories${dateRangeContext ? ' (filtered by date range)' : ''}`);

      // Step 2: Generate conversational response using OpenAI
      const systemPrompt = `You are a helpful AI assistant that answers questions based on the user's personal memories and knowledge. 

Here are the user's relevant memories:
${relevantMemories.length > 0 ? relevantMemories.map((memory, i) => `${i + 1}. ${memory}`).join('\n') : 'No relevant memories found.'}${dateRangeContext}

Instructions:
- Answer the user's question conversationally and naturally
- Use the memories provided to give personalized, accurate responses
- If the memories don't contain enough information to answer the question, say so politely
- Be friendly, helpful, and personal in your tone
- Reference specific details from the memories when relevant
- If no relevant memories are found, let the user know and suggest they might want to add more information
- If a date range was specified, acknowledge that you're focusing on that time period`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

      console.log(`🤖 AI Response generated (${aiResponse.length} chars)`);

      res.json({
        success: true,
        question,
        answer: aiResponse,
        memoriesUsed: relevantMemories.length,
        memories: relevantMemories
      });

    } catch (tempError) {
      console.error('Error in conversational search:', tempError);
      
      // Check if this is an OpenAI rate limit or quota error
      if (tempError.message && (tempError.message.includes('rate') || tempError.message.includes('quota') || tempError.message.includes('429'))) {
        console.log('🚨 OpenAI rate limit detected, using smart local fallback...');
        
        // Smart local fallback without OpenAI
        const localResponse = generateLocalResponse(question, allMatches.length > 0 ? allMatches.map(m => m.metadata?.text || '').filter(t => t.length > 0) : []);
        
        return res.json({
          success: true,
          question,
          answer: localResponse,
          memoriesUsed: allMatches.length,
          memories: allMatches.length > 0 ? allMatches.map(m => m.metadata?.text || '').filter(t => t.length > 0) : [],
          fallback: true,
          fallbackReason: 'OpenAI rate limit - using local response generation'
        });
      }
      
      // For other errors, try OpenAI fallback
      try {
        const fallbackPrompt = `You are a helpful AI assistant. The user asked: "${question}"
        
        I don't have access to specific memories right now, but please provide a helpful, general response to their question. If it's a personal question about their preferences or experiences, let them know you'd need more information about them to give a personalized answer.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: fallbackPrompt }
          ],
          max_tokens: 300,
          temperature: 0.7,
        });

        const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

        res.json({
          success: true,
          question,
          answer: aiResponse,
          memoriesUsed: 0,
          memories: [],
          fallback: true
        });
      } catch (fallbackError) {
        console.error('OpenAI fallback also failed:', fallbackError);
        
        // Final fallback to local response
        const fallbackMemories = allMatches.length > 0 ? allMatches.map(m => m.metadata?.text || '').filter(t => t.length > 0) : [];
        const localResponse = generateLocalResponse(question, fallbackMemories);
        
        res.json({
          success: true,
          question,
          answer: localResponse,
          memoriesUsed: fallbackMemories.length,
          memories: fallbackMemories,
          fallback: true,
          fallbackReason: 'OpenAI unavailable - using local response generation'
        });
      }
    }

  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: 'Failed to process chat request',
      details: error.message
    });
  }
});

// Update a memory endpoint
app.put('/api/memories/:memoryId', async (req, res) => {
  try {
    const { memoryId } = req.params;
    const { text, title, userId } = req.body;
    
    if (!memoryId) {
      return res.status(400).json({ 
        success: false,
        error: 'Memory ID is required' 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }

    if (!text) {
      return res.status(400).json({ 
        success: false,
        error: 'Memory text is required' 
      });
    }

    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    console.log(`📝 Updating memory: ${memoryId} for user: ${userId}`);
    
    // First verify the memory exists and belongs to the user
    const fetchResponse = await namespace.fetch([memoryId]);
    
    if (!fetchResponse.records || !fetchResponse.records[memoryId]) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }

    const currentMemory = fetchResponse.records[memoryId];
    const memoryUserId = currentMemory.userId || currentMemory.metadata?.userId;
    
    // Verify ownership
    if (memoryUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Memory does not belong to this user'
      });
    }

    // Generate new title if not provided or if text changed significantly
    let finalTitle = title;
    if (!title || title.trim() === '') {
      finalTitle = await generateMemoryTitle(text);
    }

    // Analyze sentiment for updated text
    const sentimentResult = await analyzeTextSentiment(text);
    
    // Update the memory with all existing fields plus new data
    const updateData = {
      _id: memoryId,
      text: text,
      title: finalTitle,
      date: currentMemory.date || currentMemory.metadata?.date,
      timestamp: currentMemory.timestamp || currentMemory.metadata?.timestamp,
      source: currentMemory.source || currentMemory.metadata?.source || 'daily_memory',
      weekday: currentMemory.weekday || currentMemory.metadata?.weekday,
      sentiment: sentimentResult.sentiment,
      sentimentConfidence: sentimentResult.confidence,
      userId: userId,
      updatedAt: new Date().toISOString()
    };
    
    await namespace.upsertRecords([updateData]);
    
    console.log(`✅ Memory updated successfully: ${memoryId}`);

    res.json({
      success: true,
      id: memoryId,
      title: finalTitle,
      message: 'Memory updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update memory',
      details: error.message
    });
  }
});

// Delete a memory endpoint
app.delete('/api/memories/:memoryId', async (req, res) => {
  try {
    const { memoryId } = req.params;
    const { userId } = req.body;
    
    if (!memoryId) {
      return res.status(400).json({ 
        success: false,
        error: 'Memory ID is required' 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }

    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    console.log(`🗑️ Attempting to delete memory: ${memoryId} for user: ${userId}`);
    
    // First verify the memory exists and belongs to the user by fetching it
    const fetchResponse = await namespace.fetch([memoryId]);
    
    if (!fetchResponse.records || !fetchResponse.records[memoryId]) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found'
      });
    }

    const memory = fetchResponse.records[memoryId];
    const memoryUserId = memory.userId || memory.metadata?.userId;
    
    // Verify ownership
    if (memoryUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Memory does not belong to this user'
      });
    }

    const memoryText = memory.text || memory.metadata?.text || '';
    
    // Delete the memory from Pinecone
    await namespace.deleteMany([memoryId]);
    
    console.log(`✅ Memory deleted successfully: ${memoryId}`);
    console.log(`📝 Deleted memory text: ${memoryText.substring(0, 50)}...`);

    res.json({
      success: true,
      message: 'Memory deleted successfully',
      deletedMemoryId: memoryId
    });

  } catch (error) {
    console.error('❌ Error deleting memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete memory',
      details: error.message
    });
  }
});

// Get memories for a specific week
app.get('/api/memories/week', async (req, res) => {
  try {
    const { startDate, userId } = req.query;
    
    if (!startDate) {
      return res.status(400).json({ error: 'startDate is required (YYYY-MM-DD format)' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    // Get all records for this user
    const queryResponse = await namespace.query({
      topK: 100,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
      filter: {
        userId: userId  // 🔑 Filter by user ID
      }
    });

    // Calculate week date range
    const start = new Date(startDate);
    const weekMemories = {};
    
    // Generate 7 days from startDate
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      weekMemories[dateStr] = {
        date: dateStr,
        weekday: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
        weekdayFull: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
        day: currentDate.getDate(),
        hasMemory: false,
        memories: []
      };
    }

    // Find memories for this week
    queryResponse.matches?.forEach(match => {
      // Try both direct field access (new format) and metadata access (old format)
      const memoryDate = match.date || match.metadata?.date;
      if (memoryDate && weekMemories[memoryDate]) {
        weekMemories[memoryDate].hasMemory = true;
        weekMemories[memoryDate].memories.push({
          id: match.id,
          text: match.text || match.metadata?.text || '',                    // Try both formats
          title: match.title || match.metadata?.title || 'Untitled Memory',  // 📝 Include title with fallback
          timestamp: match.timestamp || match.metadata?.timestamp,
          sentiment: match.sentiment || match.metadata?.sentiment || 'NEUTRAL',           // 🎭 Include sentiment
          sentimentConfidence: match.sentimentConfidence || match.metadata?.sentimentConfidence || 0 // 🎭 Include confidence
        });
      }
    });

    res.json({
      success: true,
      weekStart: startDate,
      memories: weekMemories
    });
  } catch (error) {
    console.error('Error getting week memories:', error);
    res.status(500).json({
      error: 'Failed to get week memories',
      details: error.message
    });
  }
});

// Debug endpoint to list all memories with dates
app.get('/api/debug/memories', async (req, res) => {
  try {
    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    const queryResponse = await namespace.query({
      topK: 100,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
    });

    const memories = queryResponse.matches?.map(match => ({
      id: match.id,
      date: match.metadata?.date,
      text: match.metadata?.text?.substring(0, 50) + '...',
      timestamp: match.metadata?.timestamp,
      source: match.metadata?.source
    })) || [];

    const todayStr = (() => {
      const today = new Date();
      return today.getFullYear() + '-' + 
        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
        String(today.getDate()).padStart(2, '0');
    })();

    res.json({
      success: true,
      todayDate: todayStr,
      totalMemories: memories.length,
      memories: memories.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      memoriesToday: memories.filter(m => m.date === todayStr)
    });
  } catch (error) {
    console.error('Error getting debug memories:', error);
    res.status(500).json({
      error: 'Failed to get debug memories',
      details: error.message
    });
  }
});

// Delete memory by ID (for debugging)
app.delete('/api/debug/memories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    await namespace.deleteMany([id]);
    
    res.json({
      success: true,
      message: `Memory ${id} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({
      error: 'Failed to delete memory',
      details: error.message
    });
  }
});

// File upload transcription endpoint using AssemblyAI
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    if (!assemblyaiApiKey) {
      return res.status(503).json({ 
        error: 'AssemblyAI API key not configured', 
        message: 'Please add ASSEMBLYAI_API_KEY to your .env file to enable real-time transcription'
      });
    }

    console.log('🎤 Transcribing audio file with AssemblyAI...', { 
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size 
    });

    // Read the uploaded file
    const audioBuffer = req.file.buffer;

    // Upload audio to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${assemblyaiApiKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: audioBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload audio: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('📤 Audio uploaded to AssemblyAI:', uploadResult.upload_url);

    // Request transcription
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${assemblyaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: uploadResult.upload_url,
        speech_model: 'best',
        language_code: 'en',
        punctuate: true,
        format_text: true,
      }),
    });

    if (!transcriptResponse.ok) {
      throw new Error(`Failed to request transcription: ${transcriptResponse.status}`);
    }

    const transcriptResult = await transcriptResponse.json();
    console.log('🔄 Transcription requested:', transcriptResult.id);

    // Poll for completion
    let transcript;
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptResult.id}`, {
        headers: {
          'Authorization': `Bearer ${assemblyaiApiKey}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to check transcription status: ${statusResponse.status}`);
      }

      transcript = await statusResponse.json();
      
      if (transcript.status === 'completed') {
        console.log('✅ Transcription completed successfully');
        break;
      } else if (transcript.status === 'error') {
        throw new Error(`Transcription failed: ${transcript.error}`);
      }

      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    if (transcript.status !== 'completed') {
      throw new Error('Transcription timed out');
    }

    res.json({
      success: true,
      transcript: transcript.text,
      confidence: transcript.confidence,
      processing_time: transcript.audio_duration,
    });

  } catch (error) {
    console.error('❌ Transcription error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe audio',
      details: error.stack
    });
  }
});

// Legacy base64 transcription endpoint using OpenAI Whisper
app.post('/api/transcribe-whisper', async (req, res) => {
  try {
    const { audioData, audioFormat } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    if (!assemblyai) {
      return res.status(503).json({ 
        error: 'AssemblyAI API key not configured', 
        message: 'Please add ASSEMBLYAI_API_KEY to your .env file to enable real-time transcription'
      });
    }

    console.log('🎤 Transcribing audio with AssemblyAI...', { 
      audioFormat, 
      base64Length: audioData.length,
      estimatedSizeMB: (audioData.length * 0.75 / 1024 / 1024).toFixed(2)
    });

    // Convert base64 audio data to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    console.log('📁 Audio buffer size:', audioBuffer.length, 'bytes');
    
    // Create a temporary file for the audio
    const fs = require('fs');
    const path = require('path');
    const fileExtension = audioFormat === 'm4a' ? '.m4a' : '.wav';
    const tempFilePath = path.join(__dirname, `temp_audio_${Date.now()}${fileExtension}`);
    
    // Write audio buffer to temporary file
    fs.writeFileSync(tempFilePath, audioBuffer);
    console.log('💾 Temporary file created:', tempFilePath);

    try {
      // Upload audio file to AssemblyAI
      const uploadResponse = await assemblyai.files.upload(tempFilePath);
      
      // Request transcription
      const transcript = await assemblyai.transcripts.transcribe({
        audio: uploadResponse.upload_url,
        language_code: 'en',
        punctuate: true,
        format_text: true,
      });

      // Clean up temporary file
      fs.unlinkSync(tempFilePath);

      if (transcript.status === 'error') {
        throw new Error(`AssemblyAI transcription error: ${transcript.error}`);
      }

      console.log('✅ AssemblyAI transcription completed:', transcript.text?.substring(0, 100) + '...');

      res.json({
        success: true,
        transcription: transcript.text || '',
        confidence: transcript.confidence || 0,
        message: 'Audio transcribed successfully with AssemblyAI'
      });

    } catch (transcriptionError) {
      // Clean up temporary file on error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw transcriptionError;
    }

  } catch (error) {
    console.error('Error transcribing with AssemblyAI:', error);
    res.status(500).json({
      error: 'Failed to transcribe audio with AssemblyAI',
      details: error.message
    });
  }
});

// Simple file upload transcription endpoint for recorded audio files
app.post('/api/transcribe-file', upload.single('audio'), async (req, res) => {
  try {
    console.log('🎤 File transcription request received');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'Audio file is required' 
      });
    }

    if (!assemblyaiApiKey) {
      return res.status(503).json({ 
        success: false,
        error: 'AssemblyAI API key not configured' 
      });
    }

    console.log('📁 Processing audio file:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Upload to AssemblyAI and transcribe with sentiment analysis
    const transcript = await assemblyai.transcripts.transcribe({
      audio: req.file.buffer,
      speech_model: 'best',
      sentiment_analysis: true  // 🎯 Enable sentiment analysis
    });

    if (transcript.status === 'error') {
      console.error('❌ AssemblyAI transcription error:', transcript.error);
      return res.status(500).json({
        success: false,
        error: `Transcription error: ${transcript.error}`
      });
    }

    console.log('✅ File transcription completed:', transcript.text?.substring(0, 100) + '...');
    
    // Process sentiment analysis results
    let overallSentiment = 'NEUTRAL';
    let sentimentConfidence = 0;
    let sentimentDetails = [];
    
    if (transcript.sentiment_analysis_results && transcript.sentiment_analysis_results.length > 0) {
      // Calculate overall sentiment from all segments
      const sentiments = transcript.sentiment_analysis_results.map(result => ({
        sentiment: result.sentiment,
        confidence: result.confidence,
        text: result.text
      }));
      
      // Find the most confident sentiment or use majority
      const sentimentCounts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };
      let totalConfidence = 0;
      
      sentiments.forEach(s => {
        sentimentCounts[s.sentiment]++;
        totalConfidence += s.confidence;
      });
      
      // Use the most frequent sentiment
      overallSentiment = Object.keys(sentimentCounts).reduce((a, b) => 
        sentimentCounts[a] > sentimentCounts[b] ? a : b
      );
      
      sentimentConfidence = totalConfidence / sentiments.length;
      sentimentDetails = sentiments;
      
      console.log('🎭 Sentiment analysis:', {
        overall: overallSentiment,
        confidence: sentimentConfidence,
        segments: sentiments.length
      });
    }
    
    res.json({
      success: true,
      text: transcript.text,
      confidence: transcript.confidence,
      sentiment: overallSentiment,           // 🎯 Overall sentiment: POSITIVE, NEGATIVE, NEUTRAL
      sentimentConfidence: sentimentConfidence,  // 🎯 Confidence score (0-1)
      sentimentDetails: sentimentDetails,    // 🎯 Detailed sentiment per segment
      message: 'Audio transcribed successfully with sentiment analysis'
    });

  } catch (error) {
    console.error('❌ File transcription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transcribe audio file',
      details: error.message
    });
  }
});

// ===== TODO MANAGEMENT ENDPOINTS =====

// Cost-effective AI function to extract todos from memory text
const extractTodosFromText = async (memoryText, memoryId, memoryDate) => {
  // First try simple keyword-based extraction (free)
  const simplePatterns = [
    /(?:I need to|I should|I have to|I want to|I must|Remember to|Don't forget to)\s+(.+?)(?:\.|$|,)/gi,
    /(?:TODO|Todo|todo):\s*(.+?)(?:\.|$|,)/gi,
    /(?:Task|task):\s*(.+?)(?:\.|$|,)/gi,
  ];

  const simpleTodos = [];
  for (const pattern of simplePatterns) {
    let match;
    while ((match = pattern.exec(memoryText)) !== null) {
      const todoText = match[1].trim();
      if (todoText.length > 5 && todoText.length < 200) { // Reasonable length
        simpleTodos.push({
          title: todoText,
          priority: 'medium',
          category: 'general',
          method: 'keyword'
        });
      }
    }
  }

  // If we found simple todos, return them (saves AI cost)
  if (simpleTodos.length > 0) {
    console.log(`💡 Found ${simpleTodos.length} todos using keyword extraction (free)`);
    return simpleTodos;
  }

  // Only use AI if no simple patterns found AND OpenAI is available
  if (!openai) {
    console.log('⚠️ No OpenAI available, skipping AI extraction');
    return [];
  }

  // Check if memory is likely to contain actionable items
  const actionKeywords = ['should', 'need', 'want', 'must', 'remember', 'todo', 'task', 'plan', 'goal'];
  const hasActionKeywords = actionKeywords.some(keyword => 
    memoryText.toLowerCase().includes(keyword)
  );

  if (!hasActionKeywords) {
    console.log('📝 Memory unlikely to contain actionable items, skipping AI extraction');
    return [];
  }

  try {
    console.log('🤖 Using AI for advanced todo extraction...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Extract actionable items from memory text. Return ONLY genuine tasks the person should do.
          Format as JSON array with objects containing: title, priority (high/medium/low), category.
          Categories: work, personal, health, social, learning, shopping, calls, appointments.
          Maximum 5 items. If no actionable items, return empty array.`
        },
        {
          role: 'user',
          content: `Memory: "${memoryText}"`
        }
      ],
      max_tokens: 300, // Limit tokens to control cost
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content);
    const aiTodos = Array.isArray(result) ? result.map(todo => ({
      ...todo,
      method: 'ai'
    })) : [];

    console.log(`🤖 AI extracted ${aiTodos.length} todos`);
    return aiTodos;

  } catch (error) {
    console.error('❌ AI extraction failed:', error);
    return []; // Fail gracefully
  }
};

// Get all todos for a user
app.get('/api/todos', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }

    const index = pc.index(indexName);
    const namespace = index.namespace('todos'); // 🏗️ Separate namespace for todos
    
    // Query for todos (all records in todos namespace are todos)
    const queryResponse = await namespace.query({
      topK: 100,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
      filter: {
        userId: userId
        // No type filter needed - todos namespace only contains todos
      }
    });

    const todos = queryResponse.matches?.map(match => ({
      id: match.id,
      title: match.title || match.metadata?.title || '',
      completed: match.completed || match.metadata?.completed || false,
      priority: match.priority || match.metadata?.priority || 'medium',
      category: match.category || match.metadata?.category || 'general',
      sourceMemoryId: match.sourceMemoryId || match.metadata?.sourceMemoryId,
      sourceMemoryDate: match.sourceMemoryDate || match.metadata?.sourceMemoryDate,
      sourceMemoryText: match.sourceMemoryText || match.metadata?.sourceMemoryText,
      createdAt: match.createdAt || match.metadata?.createdAt,
      completedAt: match.completedAt || match.metadata?.completedAt,
      userId: userId
    })) || [];

    // Sort: pending first, then by priority, then by date
    todos.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1; // Pending first
      }
      
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority] ?? 1;
      const bPriority = priorityOrder[b.priority] ?? 1;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority; // High priority first
      }
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Newest first
    });

    res.json({
      success: true,
      todos: todos,
      count: todos.length,
      pending: todos.filter(t => !t.completed).length,
      completed: todos.filter(t => t.completed).length
    });

  } catch (error) {
    console.error('❌ Error fetching todos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch todos',
      details: error.message
    });
  }
});

// Toggle todo completion status
app.patch('/api/todos/:todoId/toggle', async (req, res) => {
  try {
    const { todoId } = req.params;
    const { userId, completed } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }

    const index = pc.index(indexName);
    const namespace = index.namespace('todos'); // 🏗️ Separate namespace for todos
    
    // First get the current todo using fetch
    const fetchResponse = await namespace.fetch([todoId]);
    
    if (!fetchResponse.records || !fetchResponse.records[todoId]) {
      return res.status(404).json({
        success: false,
        error: 'Todo not found'
      });
    }

    const currentTodo = fetchResponse.records[todoId];
    
    // Verify ownership
    const todoUserId = currentTodo.userId || currentTodo.metadata?.userId;
    if (todoUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Todo does not belong to this user'
      });
    }
    
    // Update the todo
    const todoTitle = currentTodo.title || currentTodo.metadata?.title;
    
    // Build the update object, conditionally including completedAt
    const updateData = {
      id: todoId,
      text: todoTitle, // Required field for integrated embeddings
      title: todoTitle,
      completed: completed,
      priority: currentTodo.priority || currentTodo.metadata?.priority || 'medium',
      category: currentTodo.category || currentTodo.metadata?.category || 'general',
      sourceMemoryId: currentTodo.sourceMemoryId || currentTodo.metadata?.sourceMemoryId,
      sourceMemoryDate: currentTodo.sourceMemoryDate || currentTodo.metadata?.sourceMemoryDate,
      sourceMemoryText: currentTodo.sourceMemoryText || currentTodo.metadata?.sourceMemoryText,
      createdAt: currentTodo.createdAt || currentTodo.metadata?.createdAt,
      userId: userId
    };
    
    // Only include completedAt if the todo is completed (Pinecone doesn't accept null)
    if (completed) {
      updateData.completedAt = new Date().toISOString();
    } else {
      // For incomplete todos, use empty string instead of null
      updateData.completedAt = '';
    }
    
    await namespace.upsertRecords([updateData]);

    console.log(`✅ Todo ${todoId} marked as ${completed ? 'completed' : 'pending'}`);

    res.json({
      success: true,
      message: `Todo ${completed ? 'completed' : 'reopened'} successfully`
    });

  } catch (error) {
    console.error('❌ Error updating todo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update todo',
      details: error.message
    });
  }
});

// Extract todos from memories (cost-effective)
app.post('/api/todos/extract', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }

    const index = pc.index(indexName);
    const memoriesNamespace = index.namespace('default'); // 📝 Memories in default namespace
    const todosNamespace = index.namespace('todos');      // ✅ Todos in separate namespace
    
    console.log('🔍 Finding memories to process for todos...');
    
    // Get all memories for this user
    const memoriesQuery = await memoriesNamespace.query({
      topK: 100,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
      filter: {
        userId: userId,
        // Don't include type filter to get memories (todos are in separate namespace)
      }
    });

    // Filter out todos and already processed memories
    const memories = memoriesQuery.matches?.filter(match => {
      const recordType = match.type || match.metadata?.type;
      const todosExtracted = match.todosExtracted || match.metadata?.todosExtracted;
      return !recordType && !todosExtracted; // Only unprocessed memories
    }) || [];

    console.log(`📝 Found ${memories.length} unprocessed memories`);

    if (memories.length === 0) {
      return res.json({
        success: true,
        message: 'No new memories to process',
        newTodosCount: 0,
        totalTodosCount: 0,
        skippedMemoriesCount: 0
      });
    }

    let newTodosCount = 0;
    let skippedMemoriesCount = 0;
    const batchSize = 5; // Process in small batches to control costs

    // Process memories in batches
    for (let i = 0; i < Math.min(memories.length, batchSize); i++) {
      const memory = memories[i];
      const memoryText = memory.text || memory.metadata?.text || '';
      const memoryDate = memory.date || memory.metadata?.date;
      const memoryId = memory.id;

      if (!memoryText || memoryText.length < 10) {
        skippedMemoriesCount++;
        continue;
      }

      console.log(`🔍 Processing memory ${i + 1}/${Math.min(memories.length, batchSize)}: ${memoryText.substring(0, 50)}...`);

      try {
        // Extract todos using cost-effective method
        const extractedTodos = await extractTodosFromText(memoryText, memoryId, memoryDate);
        
        // Store each todo in Pinecone todos namespace
        for (const todo of extractedTodos) {
          const todoId = `todo-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          await todosNamespace.upsertRecords([{
            id: todoId,
            text: todo.title, // Required field for integrated embeddings
            title: todo.title,
            completed: false,
            priority: todo.priority || 'medium',
            category: todo.category || 'general',
            sourceMemoryId: memoryId,
            sourceMemoryDate: memoryDate,
            sourceMemoryText: memoryText.substring(0, 200), // Store snippet
            createdAt: new Date().toISOString(),
            userId: userId,
            extractionMethod: todo.method // Track extraction method
          }]);

          newTodosCount++;
        }

        // Mark memory as processed to avoid reprocessing
        const updatedMemory = {
          id: memoryId,
          text: memoryText,
          date: memoryDate,
          timestamp: memory.timestamp || memory.metadata?.timestamp,
          source: memory.source || memory.metadata?.source || 'daily_memory',
          weekday: memory.weekday || memory.metadata?.weekday,
          sentiment: memory.sentiment || memory.metadata?.sentiment || 'NEUTRAL',
          sentimentConfidence: memory.sentimentConfidence || memory.metadata?.sentimentConfidence || 0,
          userId: userId,
          todosExtracted: true, // Mark as processed
          todosExtractedAt: new Date().toISOString(),
          todosExtractedCount: extractedTodos.length
        };

        await memoriesNamespace.upsertRecords([updatedMemory]);

      } catch (error) {
        console.error(`❌ Error processing memory ${memoryId}:`, error);
        skippedMemoriesCount++;
      }
    }

    // Get total todos count from todos namespace
    const todosQuery = await todosNamespace.query({
      topK: 100,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
      filter: {
        userId: userId
      }
    });

    const totalTodosCount = todosQuery.matches?.length || 0;

    console.log(`✅ Extraction complete: ${newTodosCount} new todos, ${skippedMemoriesCount} skipped`);

    res.json({
      success: true,
      message: `Successfully extracted ${newTodosCount} action items`,
      newTodosCount: newTodosCount,
      totalTodosCount: totalTodosCount,
      skippedMemoriesCount: skippedMemoriesCount,
      processedMemoriesCount: Math.min(memories.length, batchSize)
    });

  } catch (error) {
    console.error('❌ Error extracting todos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract todos',
      details: error.message
    });
  }
});

// List all memories endpoint (for debugging)
app.get('/api/memories', async (req, res) => {
  try {
    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    // Get all records by querying with a dummy vector
    const queryResponse = await namespace.query({
      topK: 100,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
    });
    
    const memories = queryResponse.matches?.map(match => ({
      id: match.id,
      text: match.metadata?.text || '',
      timestamp: match.metadata?.timestamp || '',
      source: match.metadata?.source || 'unknown',
    })) || [];
    
    res.json({
      success: true,
      memories,
      count: memories.length
    });
  } catch (error) {
    console.error('Error listing memories:', error);
    res.status(500).json({
      error: 'Failed to list memories',
      details: error.message
    });
  }
});

// Start server
async function startServer() {
  console.log('Starting Pinecone Memory API server...');
  
  // Initialize Pinecone index first
  const initialized = await initializeIndex();
  if (!initialized) {
    console.error('Failed to initialize Pinecone index');
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`💾 Store memory: POST http://localhost:${port}/api/memories`);
    console.log(`🔍 Search memories: POST http://localhost:${port}/api/memories/search`);
    console.log(`🎤 Streaming transcription: WS http://localhost:${port}/ws/transcribe`);
  });

  // Create WebSocket server for streaming transcription
  const wss = new WebSocketServer({ server, path: '/ws/transcribe' });

  wss.on('connection', (ws) => {
    console.log('🎤 New WebSocket connection for streaming transcription');
    let assemblyAiRt = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'start') {
          console.log('🎯 Starting real-time transcription session');
          
          if (!assemblyaiApiKey) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'AssemblyAI API key not configured'
            }));
            return;
          }

          // Create AssemblyAI streaming transcription session with new API
          assemblyAiRt = assemblyai.streaming.transcriber({
            sampleRate: data.sampleRate || 16000,
            wordBoost: ['memory', 'feeling', 'today', 'yesterday', 'tomorrow'],
            formatTurns: true
          });

          // Handle transcription events with new API
          assemblyAiRt.on('open', ({ id }) => {
            console.log('✅ AssemblyAI streaming session opened with ID:', id);
            ws.send(JSON.stringify({ type: 'session_opened', sessionId: id }));
          });

          assemblyAiRt.on('turn', (turn) => {
            if (!turn.transcript) {
              return;
            }
            console.log('📝 Turn received:', turn.transcript);
            ws.send(JSON.stringify({
              type: 'transcript',
              text: turn.transcript,
              message_type: 'FinalTranscript',
              confidence: turn.confidence || 0.9
            }));
          });

          assemblyAiRt.on('error', (error) => {
            console.error('❌ AssemblyAI error:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: error.message || error.toString()
            }));
          });

          assemblyAiRt.on('close', (code, reason) => {
            console.log('🔚 AssemblyAI session closed:', code, reason);
            ws.send(JSON.stringify({ type: 'session_closed', code, reason }));
          });

          // Connect to AssemblyAI with new API
          await assemblyAiRt.connect();

        } else if (data.type === 'audio_data' && assemblyAiRt) {
          // Forward audio data to AssemblyAI streaming API
          const audioBuffer = Buffer.from(data.audio, 'base64');
          // Send audio data to the stream
          if (assemblyAiRt.stream() && !assemblyAiRt.stream().destroyed) {
            assemblyAiRt.stream().write(audioBuffer);
          }

        } else if (data.type === 'stop' && assemblyAiRt) {
          console.log('🛑 Stopping transcription session');
          await assemblyAiRt.close();
          assemblyAiRt = null;

        } else if (data.type === 'save_memory') {
          // Save the final transcription as a memory
          console.log('💾 Saving transcribed memory:', data.text?.substring(0, 50) + '...');
          
          if (!data.text || !data.date) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Missing text or date for memory'
            }));
            return;
          }

          try {
            // Use the same logic as the regular memory endpoint
            const index = pc.index(indexName);
            const namespace = index.namespace('default');
            const dateStr = data.date;
            
            // Check how many memories exist for this date and user (max 5 allowed)
            const existingQuery = await namespace.query({
              topK: 100,
              includeMetadata: true,
              includeValues: false,
              vector: new Array(1024).fill(0.001),
              filter: {
                userId: data.userId  // Filter by user ID
              }
            });

            const existingMemories = existingQuery.matches?.filter(match => {
              const memoryDate = match.date || match.metadata?.date;
              const memoryUserId = match.userId || match.metadata?.userId;
              return memoryDate === dateStr && memoryUserId === data.userId;
            }) || [];

            if (existingMemories.length >= 5) {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Maximum memories reached for this date. You can only store up to 5 memories per day.'
              }));
              return;
            }

            const id = `memory-${dateStr}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Save to Pinecone with integrated embeddings
            await namespace.upsertRecords([{
              _id: id,
              text: data.text,
              date: dateStr,
              timestamp: new Date().toISOString(),
              source: 'streaming_voice',
              weekday: new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
            }]);

            console.log('✅ Streaming memory saved successfully');
            ws.send(JSON.stringify({
              type: 'memory_saved',
              id: id,
              date: dateStr
            }));

          } catch (error) {
            console.error('❌ Error saving streaming memory:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Failed to save memory: ' + error.message
            }));
          }
        }

      } catch (error) {
        console.error('❌ WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });

    ws.on('close', async () => {
      console.log('🔌 WebSocket connection closed');
      if (assemblyAiRt) {
        await assemblyAiRt.close();
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  });
}

startServer().catch(console.error);
