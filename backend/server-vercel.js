const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const { AssemblyAI } = require('assemblyai');
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
});

// Initialize APIs
const pineconeApiKey = process.env.PINECONE_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY;

if (!pineconeApiKey) {
  console.error('❌ PINECONE_API_KEY is required');
  process.exit(1);
}

const pc = new Pinecone({ apiKey: pineconeApiKey });
const indexName = 'developer-quickstart-js';

// Initialize OpenAI (optional)
let openai = null;
if (openaiApiKey) {
  openai = new OpenAI({ apiKey: openaiApiKey });
  console.log('✅ OpenAI initialized');
} else {
  console.log('⚠️ OpenAI API key not provided - chat features will be disabled');
}

// Initialize AssemblyAI (optional)
let assemblyai = null;
if (assemblyaiApiKey) {
  assemblyai = new AssemblyAI({ apiKey: assemblyaiApiKey });
  console.log('✅ AssemblyAI initialized');
} else {
  console.log('⚠️ AssemblyAI API key not provided - voice transcription will be disabled');
}

// Helper function to get today's date in local timezone
function getTodayLocalDate() {
  const today = new Date();
  return today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
}

// Helper function to validate date format
function isValidDateFormat(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(dateString);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Memory backend is running!',
    timestamp: new Date().toISOString(),
    services: {
      pinecone: !!pineconeApiKey,
      openai: !!openaiApiKey,
      assemblyai: !!assemblyaiApiKey
    }
  });
});

// Store memory endpoint
app.post('/api/memories', async (req, res) => {
  try {
    const { text, date, metadata } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        success: false,
        error: 'Text is required' 
      });
    }

    // Validate and set date
    let dateStr;
    if (date) {
      if (!isValidDateFormat(date)) {
        return res.status(400).json({
          success: false,
          error: 'Date must be in YYYY-MM-DD format'
        });
      }
      dateStr = date;
    } else {
      dateStr = getTodayLocalDate();
    }

    // Only allow memories for today
    const todayStr = getTodayLocalDate();
    if (dateStr !== todayStr) {
      return res.status(400).json({
        success: false,
        error: 'You can only create memories for today. Edit existing memories for other dates.'
      });
    }

    console.log(`📝 Storing memory for date: ${dateStr}`);

    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    // Check how many memories exist for this date (max 5 allowed)
    const existingQuery = await namespace.query({
      topK: 100,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
    });

    const existingMemories = existingQuery.matches?.filter(match => 
      match.metadata?.date === dateStr
    ) || [];

    if (existingMemories.length >= 5) {
      return res.status(400).json({
        success: false,
        error: 'Maximum memories reached for this date. You can only store up to 5 memories per day.'
      });
    }

    // Generate unique ID for this memory
    const id = `memory-${dateStr}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate weekday
    const weekday = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    
    // Prepare metadata
    const memoryMetadata = {
      text: text,
      date: dateStr,
      timestamp: new Date().toISOString(),
      weekday: weekday,
      source: metadata?.source || 'text_input',
      ...metadata
    };

    // Store in Pinecone with integrated embeddings
    await namespace.upsertRecords([{
      id: id,
      metadata: memoryMetadata
    }]);

    console.log(`✅ Memory stored successfully with ID: ${id}`);
    
    res.json({ 
      success: true,
      message: 'Memory saved successfully',
      id: id,
      date: dateStr
    });

  } catch (error) {
    console.error('❌ Error storing memory:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to store memory',
      details: error.message
    });
  }
});

// Search memories endpoint
app.post('/api/memories/search', async (req, res) => {
  try {
    const { query, maxResults = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    // Perform semantic search using integrated embeddings
    const searchResults = await namespace.query({
      data: query,
      topK: maxResults,
      includeMetadata: true,
      includeValues: false
    });

    const memories = searchResults.matches?.map(match => ({
      id: match.id,
      text: match.metadata?.text || '',
      date: match.metadata?.date || '',
      timestamp: match.metadata?.timestamp || '',
      weekday: match.metadata?.weekday || '',
      score: match.score || 0,
      source: match.metadata?.source || 'unknown'
    })) || [];

    res.json({
      success: true,
      memories: memories,
      query: query,
      totalResults: memories.length
    });

  } catch (error) {
    console.error('❌ Error searching memories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search memories',
      details: error.message
    });
  }
});

// Get memories for a week endpoint
app.get('/api/memories/week', async (req, res) => {
  try {
    const { startDate } = req.query;
    
    if (!startDate || !isValidDateFormat(startDate)) {
      return res.status(400).json({ 
        success: false,
        error: 'Valid startDate (YYYY-MM-DD) is required' 
      });
    }

    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    // Get all memories and filter by date range
    const allMemoriesQuery = await namespace.query({
      topK: 1000,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
    });

    // Calculate the week date range
    const start = new Date(startDate + 'T00:00:00');
    const weekMemories = {};
    
    // Initialize week structure
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      weekMemories[dateStr] = {
        date: dateStr,
        hasMemory: false,
        memories: [] // Changed from memory: null to memories: []
      };
    }

    // Filter and organize memories by date
    if (allMemoriesQuery.matches) {
      allMemoriesQuery.matches.forEach(match => {
        const memoryDate = match.metadata?.date;
        if (memoryDate && weekMemories[memoryDate]) {
          weekMemories[memoryDate].hasMemory = true;
          weekMemories[memoryDate].memories.push({ // Changed to push to memories array
            id: match.id,
            text: match.metadata?.text || '',
            timestamp: match.metadata?.timestamp || '',
            weekday: match.metadata?.weekday || '',
            source: match.metadata?.source || 'unknown'
          });
        }
      });
    }

    res.json({
      success: true,
      memories: weekMemories,
      startDate: startDate
    });

  } catch (error) {
    console.error('❌ Error fetching week memories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch week memories',
      details: error.message
    });
  }
});

// File transcription endpoint for recorded audio files
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

    // Upload to AssemblyAI and transcribe
    const transcript = await assemblyai.transcripts.transcribe({
      audio: req.file.buffer,
      speech_model: 'best'
    });

    if (transcript.status === 'error') {
      console.error('❌ AssemblyAI transcription error:', transcript.error);
      return res.status(500).json({
        success: false,
        error: `Transcription error: ${transcript.error}`
      });
    }

    console.log('✅ File transcription completed:', transcript.text?.substring(0, 100) + '...');
    
    res.json({
      success: true,
      text: transcript.text,
      confidence: transcript.confidence,
      message: 'Audio transcribed successfully'
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

// Conversational RAG endpoint - Ask questions about your memories
app.post('/api/chat', async (req, res) => {
  try {
    const { question, maxMemories = 5 } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Check if OpenAI is available
    if (!openai) {
      return res.status(503).json({ 
        error: 'OpenAI is not configured. Please add OPENAI_API_KEY to your environment variables.' 
      });
    }

    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    // Search for relevant memories using integrated embeddings
    const searchResults = await namespace.query({
      data: question,
      topK: maxMemories,
      includeMetadata: true,
      includeValues: false
    });

    const relevantMemories = searchResults.matches?.map(match => ({
      text: match.metadata?.text || '',
      date: match.metadata?.date || '',
      weekday: match.metadata?.weekday || '',
      score: match.score || 0
    })) || [];

    if (relevantMemories.length === 0) {
      return res.json({
        success: true,
        answer: "I couldn't find any relevant memories to answer your question. Try asking about something you've recorded before.",
        relevantMemories: [],
        question: question
      });
    }

    // Create context from relevant memories
    const context = relevantMemories
      .map(memory => `${memory.weekday}, ${memory.date}: ${memory.text}`)
      .join('\n\n');

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers questions based on the user's personal memories. Use the provided memory context to give accurate, helpful answers. If the memories don't contain enough information to answer the question, say so politely. Be conversational and refer to the memories naturally."
        },
        {
          role: "user",
          content: `Question: ${question}\n\nRelevant memories:\n${context}`
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const answer = completion.choices[0]?.message?.content || "I couldn't generate a response.";

    res.json({
      success: true,
      answer: answer,
      relevantMemories: relevantMemories,
      question: question,
      memoryCount: relevantMemories.length
    });

  } catch (error) {
    console.error('❌ Error in conversational endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process question',
      details: error.message
    });
  }
});

async function startServer() {
  try {
    // Check if Pinecone index exists, create if it doesn't
    try {
      const indexDescription = await pc.describeIndex(indexName);
      console.log(`✅ Connected to existing Pinecone index: ${indexName}`);
      console.log(`📊 Index dimension: ${indexDescription.dimension}`);
    } catch (error) {
      if (error.message?.includes('not found')) {
        console.log(`📝 Creating Pinecone index: ${indexName}`);
        await pc.createIndex({
          name: indexName,
          dimension: 1024,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          },
          integrations: {
            llamaTextEmbeddingV2: {
              enabled: true,
              textField: 'text'
            }
          }
        });
        console.log(`✅ Created Pinecone index: ${indexName}`);
      } else {
        throw error;
      }
    }

    const server = app.listen(port, () => {
      console.log(`✅ Server running on http://localhost:${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`💾 Store memory: POST http://localhost:${port}/api/memories`);
      console.log(`🔍 Search memories: POST http://localhost:${port}/api/memories/search`);
      console.log(`🎤 File transcription: POST http://localhost:${port}/api/transcribe-file`);
      console.log(`💬 Chat with memories: POST http://localhost:${port}/api/chat`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch(console.error);

// Export for Vercel
module.exports = app;
// Force redeploy Fri Sep 26 12:19:25 BST 2025
