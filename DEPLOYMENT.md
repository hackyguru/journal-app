# 🚀 Backend Deployment Guide

## 🔷 **Vercel Deployment** (Recommended for pricing)

Your app has been optimized for Vercel! Voice recording now uses file upload instead of WebSocket streaming.

### 1. Deploy to Vercel (Easy!)
```bash
cd backend
./deploy-vercel.sh
```

### 2. Set Environment Variables
In Vercel dashboard → Your Project → Settings → Environment Variables:
```
PINECONE_API_KEY=your_pinecone_api_key
OPENAI_API_KEY=your_openai_api_key  
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
```

### 3. Update Frontend
Update your `.env` file:
```
EXPO_PUBLIC_BACKEND_URL=https://your-app-name.vercel.app
```

---

## 🛤️ Alternative: Deploy to Railway (supports WebSockets)

### 1. Setup Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
cd backend
railway init
```

### 2. Set Environment Variables
In Railway dashboard, add these environment variables:
```
PINECONE_API_KEY=your_pinecone_api_key
OPENAI_API_KEY=your_openai_api_key  
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
PORT=3001
```

### 3. Deploy
```bash
railway up
```

### 4. Get your Railway URL
```bash
railway domain
```

### 5. Update Frontend
Update your `.env` file:
```
EXPO_PUBLIC_BACKEND_URL=https://your-app-name.railway.app
```

---

## 🔷 Deploy to Vercel (No WebSockets)

⚠️ **Note**: This will disable the streaming voice assistant feature.

### 1. Setup Vercel
```bash
npm install -g vercel
cd backend
vercel
```

### 2. Set Environment Variables
In Vercel dashboard:
- PINECONE_API_KEY
- OPENAI_API_KEY  
- ASSEMBLYAI_API_KEY

### 3. Update server.js
You'll need to remove WebSocket code for Vercel.

---

## 🎨 Deploy to Render

### 1. Connect GitHub
- Push your code to GitHub
- Connect repository in Render dashboard

### 2. Create Web Service
- Build Command: `npm install`
- Start Command: `node server.js`
- Environment: Node

### 3. Set Environment Variables
Same as Railway.

---

## 📱 Update Frontend After Deployment

1. Update `.env`:
```bash
EXPO_PUBLIC_BACKEND_URL=https://your-deployed-backend-url
```

2. Restart Expo:
```bash
npx expo start --clear
```

## ✅ Test Deployment

Visit: `https://your-backend-url/health`

Should return: `{"status": "OK", "message": "Memory backend is running!"}`
