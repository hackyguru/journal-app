# Memory App 🧠

A beautiful, native iOS-style React Native app for capturing and managing daily memories with AI-powered features.

## ✨ Features

- **📝 Daily Memory Capture**: Write, record voice, or chat with AI to capture memories
- **🎤 Voice Recording**: Real-time transcription using AssemblyAI
- **🤖 AI Assistant**: Conversational memory capture powered by OpenAI GPT
- **💬 Memory Chat**: Ask questions about your stored memories with intelligent responses
- **📅 Weekly Calendar**: Beautiful native iOS calendar with memory indicators
- **🔍 Vector Search**: Advanced semantic search using Pinecone vector database
- **🍎 Native iOS Design**: Authentic iOS look and feel following Human Interface Guidelines

## 🏗️ Architecture

### Frontend (React Native + Expo)
- **Native iOS Design System**: Custom design tokens matching iOS system colors, typography, and spacing
- **Safe Area Handling**: Proper iOS safe area management
- **Voice Recording**: Real-time audio capture and transcription
- **Vector Database Integration**: Semantic search and storage

### Backend (Node.js + Express)
- **Pinecone Integration**: Vector database for memory storage and retrieval
- **OpenAI Integration**: GPT-powered conversational AI and embeddings
- **AssemblyAI Integration**: Real-time speech-to-text transcription
- **RESTful API**: Clean endpoints for memory operations

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator or physical iOS device

### Environment Setup
Create a `.env` file in the root directory:
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:3001
```

Create a `.env` file in the `backend` directory:
```env
PINECONE_API_KEY=your_pinecone_api_key
OPENAI_API_KEY=your_openai_api_key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
```

### Installation

1. **Install frontend dependencies**
   ```bash
   npm install
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Start the backend server**
   ```bash
   cd backend
   npm start
   ```

4. **Start the Expo app**
   ```bash
   npx expo start
   ```

## 📁 Project Structure

```
memory/
├── app/                          # Expo Router pages
│   ├── (tabs)/
│   │   ├── index.tsx            # Home screen with calendar
│   │   ├── chat.tsx             # Memory chat interface
│   │   └── _layout.tsx          # Tab navigation
│   └── _layout.tsx              # Root layout
├── components/                   # Reusable components
│   ├── ui/
│   │   ├── ios-design-system.tsx # Native iOS design tokens
│   │   └── icon-symbol.tsx      # Icon components
│   ├── daily-memory.tsx         # Memory input component
│   ├── weekly-calendar.tsx      # Calendar component
│   ├── voice-recorder.tsx       # Voice recording
│   ├── conversational-assistant.tsx # AI chat
│   └── memory-chat.tsx          # Memory Q&A
├── hooks/
│   └── usePinecone.ts           # Pinecone integration hook
├── backend/                     # Node.js server
│   ├── server.js               # Express server
│   └── package.json            # Backend dependencies
└── assets/                     # App icons and images
```

## 🎨 Design System

The app uses a custom iOS design system that follows Apple's Human Interface Guidelines:

- **Colors**: iOS semantic colors (systemBlue, systemBackground, etc.)
- **Typography**: San Francisco font system with proper weights and sizes
- **Spacing**: 8pt grid system matching iOS standards
- **Components**: Native iOS-style cards, buttons, and forms
- **Safe Areas**: Proper handling of notches and home indicators

## 🔧 API Endpoints

### Memory Operations
- `POST /api/memories` - Store a new memory
- `GET /api/memories/week?startDate=YYYY-MM-DD` - Get memories for a week
- `POST /api/memories/search` - Semantic search memories
- `POST /api/memories/ask` - Ask questions about memories

### AI Services
- `POST /api/transcribe` - Transcribe audio using AssemblyAI
- `POST /api/chat` - Conversational AI for memory capture

## 🛠️ Technologies Used

- **Frontend**: React Native, Expo, TypeScript
- **Backend**: Node.js, Express
- **Database**: Pinecone Vector Database
- **AI Services**: OpenAI GPT, AssemblyAI
- **Audio**: Expo AV for recording
- **Design**: Custom iOS Design System

## 📱 iOS Features

- Native iOS typography (San Francisco)
- System colors with semantic naming
- Inset grouped cards (iOS 13+ style)
- Proper safe area handling
- 44pt touch targets for accessibility
- iOS-style navigation and transitions

## 🔮 Future Enhancements

- Dark mode support
- iCloud sync
- Widgets for quick memory capture
- Apple Watch companion app
- Advanced memory analytics
- Export capabilities

---

Built with ❤️ using React Native and Expo