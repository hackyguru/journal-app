#!/bin/bash

echo "🚀 Memory App Backend Deployment Script"
echo "======================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

echo "🔐 Please make sure you have set these environment variables in Railway:"
echo "- PINECONE_API_KEY"
echo "- OPENAI_API_KEY"
echo "- ASSEMBLYAI_API_KEY"
echo ""

read -p "Have you set up the environment variables in Railway? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying to Railway..."
    railway up
    
    echo "✅ Deployment complete!"
    echo "🌐 Getting your app URL..."
    railway domain
    
    echo ""
    echo "📱 Next steps:"
    echo "1. Copy the Railway URL above"
    echo "2. Update your frontend .env file:"
    echo "   EXPO_PUBLIC_BACKEND_URL=https://your-railway-url"
    echo "3. Restart your Expo app: npx expo start --clear"
else
    echo "❌ Please set up environment variables first:"
    echo "1. Run: railway login"
    echo "2. Go to your Railway dashboard"
    echo "3. Add the environment variables"
    echo "4. Run this script again"
fi
