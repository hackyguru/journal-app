const express = require('express');
const cors = require('cors');
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

// Initialize Pinecone
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || 'pcsk_5rf25M_8kQ5DG4iLQx1hDPH5Es3fawdP67ozA2c5hwVBFXuRb3oSbcAc4syA5sZkZ1C7oa'
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

// Smart local response generation (fallback when OpenAI is unavailable)
function generateLocalResponse(question, memories) {
  const lowerQuestion = question.toLowerCase();
  
  // If we have relevant memories, use them to generate a response
  if (memories && memories.length > 0) {
    // Question type detection
    if (lowerQuestion.includes('favorite') || lowerQuestion.includes('like') || lowerQuestion.includes('prefer')) {
      if (lowerQuestion.includes('fruit')) {
        const fruitMemory = memories.find(m => m.toLowerCase().includes('fruit') || m.toLowerCase().includes('mango') || m.toLowerCase().includes('apple'));
        if (fruitMemory) {
          return `Based on your memories, ${fruitMemory.includes('mango') ? 'your favorite fruit is mango' : 'you enjoy fruits like apples'}. ${fruitMemory}`;
        }
      }
      
      if (lowerQuestion.includes('pet') || lowerQuestion.includes('animal')) {
        const petMemory = memories.find(m => m.toLowerCase().includes('pet') || m.toLowerCase().includes('cat') || m.toLowerCase().includes('dog'));
        if (petMemory) {
          return `From your memories about pets: ${petMemory}`;
        }
      }
      
      if (lowerQuestion.includes('programming') || lowerQuestion.includes('language') || lowerQuestion.includes('code')) {
        const techMemory = memories.find(m => m.toLowerCase().includes('programming') || m.toLowerCase().includes('javascript') || m.toLowerCase().includes('react'));
        if (techMemory) {
          return `Regarding programming, I found this in your memories: ${techMemory}`;
        }
      }
    }
    
    // General question handling
    if (lowerQuestion.includes('what') || lowerQuestion.includes('tell me')) {
      return `Based on your stored memories, here's what I found: ${memories[0]}${memories.length > 1 ? ` I also found ${memories.length - 1} other related memories.` : ''}`;
    }
    
    // Default response with memories
    return `I found ${memories.length} relevant memor${memories.length === 1 ? 'y' : 'ies'} related to your question: ${memories[0]}${memories.length > 1 ? ` Plus ${memories.length - 1} more related memories.` : ''}`;
  }
  
  // No relevant memories found
  return `I couldn't find specific memories related to "${question}". You might want to add more information about this topic to your memory collection so I can give you better personalized responses in the future.`;
}

// Initialize index (create if doesn't exist)
async function initializeIndex() {
  try {
    console.log('Checking if index exists...');
    const existingIndexes = await pc.listIndexes();
    const indexExists = existingIndexes.indexes?.some(index => index.name === indexName);

    if (!indexExists) {
      console.log('Creating index with integrated embeddings...');
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
      console.log('Index created successfully!');
    } else {
      console.log('Index already exists');
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

// Store memory endpoint
app.post('/api/memories', async (req, res) => {
  try {
    const { text, date, metadata = {} } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Validate date format and ensure it's today
    const memoryDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    memoryDate.setHours(0, 0, 0, 0);


    if (memoryDate.getTime() !== today.getTime()) {
      return res.status(400).json({ 
        error: 'Can only create memories for today',
        message: 'You can only add memories for the current day'
      });
    }

    const index = pc.index(indexName);
    const dateStr = memoryDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Check if memory already exists for this date
    const namespace = index.namespace('default');
    const existingQuery = await namespace.query({
      topK: 100,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
    });

    const existingMemory = existingQuery.matches?.find(match => 
      match.metadata?.date === dateStr
    );

    if (existingMemory) {
      return res.status(400).json({
        error: 'Memory already exists for this date',
        message: 'You can only store one memory per day. Edit or replace the existing memory.',
        existingMemory: {
          id: existingMemory.id,
          text: existingMemory.metadata?.text || '',
          date: existingMemory.metadata?.date
        }
      });
    }

    const id = `memory-${dateStr}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Upsert with integrated embeddings including date
    await namespace.upsertRecords([
      {
        _id: id,
        text: text, // This field matches the fieldMap configuration
        date: dateStr,
        timestamp: new Date().toISOString(),
        source: 'daily_memory',
        weekday: memoryDate.toLocaleDateString('en-US', { weekday: 'long' }),
        ...metadata,
      },
    ]);


    res.json({
      success: true,
      id,
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
        
        console.log(`Query: "${query}" | Max: ${maxScore.toFixed(4)} | Avg: ${avgScore.toFixed(4)} | Threshold: ${dynamicThreshold.toFixed(4)}`);
        
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

      console.log('Search completed:', { query, resultsCount: matches.length });

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
    const { question, maxMemories = 5 } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
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

      // Query for relevant memories
      const queryResponse = await namespace.query({
        id: tempId,
        topK: maxMemories + 1,
        includeMetadata: true,
        includeValues: false,
      });

      // Clean up temp record
      await namespace.deleteOne(tempId);

      // Filter and format relevant memories
      const allMatches = queryResponse.matches?.filter(match => match.id !== tempId) || [];
      
      let relevantMemories = [];
      if (allMatches.length > 0) {
        const scores = allMatches.map(m => m.score);
        const maxScore = Math.max(...scores);
        const dynamicThreshold = Math.max(maxScore * 0.25, 0.02);
        
        relevantMemories = allMatches
          .filter(match => match.score >= dynamicThreshold)
          .map(match => match.metadata?.text || '')
          .filter(text => text.length > 0)
          .slice(0, maxMemories);
      }

      console.log(`🔍 Found ${relevantMemories.length} relevant memories`);

      // Step 2: Generate conversational response using OpenAI
      const systemPrompt = `You are a helpful AI assistant that answers questions based on the user's personal memories and knowledge. 

Here are the user's relevant memories:
${relevantMemories.length > 0 ? relevantMemories.map((memory, i) => `${i + 1}. ${memory}`).join('\n') : 'No relevant memories found.'}

Instructions:
- Answer the user's question conversationally and naturally
- Use the memories provided to give personalized, accurate responses
- If the memories don't contain enough information to answer the question, say so politely
- Be friendly, helpful, and personal in your tone
- Reference specific details from the memories when relevant
- If no relevant memories are found, let the user know and suggest they might want to add more information`;

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

// Get memories for a specific week
app.get('/api/memories/week', async (req, res) => {
  try {
    const { startDate } = req.query;
    
    if (!startDate) {
      return res.status(400).json({ error: 'startDate is required (YYYY-MM-DD format)' });
    }

    const index = pc.index(indexName);
    const namespace = index.namespace('default');
    
    // Get all records
    const queryResponse = await namespace.query({
      topK: 100,
      includeMetadata: true,
      includeValues: false,
      vector: new Array(1024).fill(0.001),
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
        memory: null
      };
    }

    // Find memories for this week
    queryResponse.matches?.forEach(match => {
      const memoryDate = match.metadata?.date;
      if (memoryDate && weekMemories[memoryDate]) {
        weekMemories[memoryDate].hasMemory = true;
        weekMemories[memoryDate].memory = {
          id: match.id,
          text: match.metadata?.text || '',
          timestamp: match.metadata?.timestamp
        };
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

// Audio transcription endpoint using OpenAI Whisper
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioData, audioFormat } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    if (!openai) {
      return res.status(503).json({ 
        error: 'OpenAI API key not configured', 
        message: 'Please add OPENAI_API_KEY to your .env file to enable voice transcription'
      });
    }

    console.log('🎤 Transcribing audio with OpenAI Whisper...');

    // Convert base64 audio data to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Create form data for Whisper API
    const FormData = require('form-data');
    const formData = new FormData();
    
    // Add the audio buffer directly to form data
    formData.append('file', audioBuffer, {
      filename: 'recording.wav',
      contentType: 'audio/wav',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    // Send to OpenAI Whisper
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Whisper API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Whisper transcription completed:', result.text?.substring(0, 100) + '...');

    res.json({
      success: true,
      transcription: result.text || '',
      message: 'Audio transcribed successfully'
    });

  } catch (error) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({
      error: 'Failed to transcribe audio',
      details: error.message
    });
  }
});

// AssemblyAI transcription endpoint
app.post('/api/transcribe-assemblyai', async (req, res) => {
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

  app.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`💾 Store memory: POST http://localhost:${port}/api/memories`);
    console.log(`🔍 Search memories: POST http://localhost:${port}/api/memories/search`);
  });
}

startServer().catch(console.error);
