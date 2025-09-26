#!/bin/bash

echo "🔷 Memory App Vercel Deployment Script"
echo "======================================"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "📋 Vercel Deployment Checklist:"
echo "✅ Using server-vercel.js (WebSocket-free version)"
echo "✅ File upload transcription will work"
echo "⚠️  Streaming voice assistant will be disabled"
echo ""

echo "🔐 Environment Variables needed in Vercel:"
echo "- PINECONE_API_KEY"
echo "- OPENAI_API_KEY (optional - for chat feature)"
echo "- ASSEMBLYAI_API_KEY (required - for voice transcription)"
echo ""

read -p "Have you set up the environment variables in Vercel dashboard? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying to Vercel..."
    
    # Deploy using vercel.json configuration
    vercel --prod
    
    echo "✅ Deployment complete!"
    echo ""
    echo "📱 Next steps:"
    echo "1. Copy your Vercel URL from above"
    echo "2. Update your frontend .env file:"
    echo "   EXPO_PUBLIC_BACKEND_URL=https://your-vercel-url.vercel.app"
    echo "3. Restart your Expo app: npx expo start --clear"
    echo ""
    echo "🎤 Note: Voice recording will use file upload (not streaming)"
    echo "   This is actually more reliable and works great!"
else
    echo "❌ Please set up environment variables first:"
    echo ""
    echo "1. Run: vercel"
    echo "2. Go to your Vercel dashboard"
    echo "3. Navigate to your project → Settings → Environment Variables"
    echo "4. Add the required environment variables"
    echo "5. Run this script again"
    echo ""
    echo "🔗 Vercel Dashboard: https://vercel.com/dashboard"
fi
