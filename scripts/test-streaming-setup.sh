#!/bin/bash

# StreamFi V2 Streaming Test Setup Script
# This script helps you test the new streaming backend

echo "🚀 StreamFi V2 Streaming Test Setup"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📋 Checking prerequisites..."

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "✅ Environment file found"
else
    echo "⚠️  .env.local not found. Creating template..."
    cat > .env.local << EOF
# Database Configuration
DATABASE_URL=your_database_url_here

# Livepeer Configuration (REQUIRED)
LIVEPEER_API_KEY=your_livepeer_api_key_here

# Optional: Webhook Configuration
WEBHOOK_SECRET=your_webhook_secret_here

# Optional: Debug Mode
DEBUG_STREAMING=true
EOF
    echo "📝 Please update .env.local with your configuration"
fi

# Check if dependencies are installed
if [ -d "node_modules" ]; then
    echo "✅ Dependencies installed"
else
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if database schema is updated
echo ""
echo "🗄️  Checking database schema..."

# Run the schema update script
if [ -f "scripts/update-streaming-schema.mjs" ]; then
    echo "📊 Updating database schema..."
    node scripts/update-streaming-schema.mjs
    if [ $? -eq 0 ]; then
        echo "✅ Database schema updated successfully"
    else
        echo "⚠️  Database schema update failed. Please check your database configuration."
    fi
else
    echo "❌ Schema update script not found"
fi

echo ""
echo "🧪 Testing API endpoints..."

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v2/streaming/health 2>/dev/null)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ Health endpoint responding"
else
    echo "⚠️  Health endpoint not responding (make sure the server is running)"
fi

echo ""
echo "🎯 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env.local file with your configuration"
echo "2. Start the development server: npm run dev"
echo "3. Open http://localhost:3000/streaming-test in your browser"
echo "4. Test the streaming functionality"
echo ""
echo "📚 Documentation:"
echo "- API Documentation: docs/STREAMING_V2_API.md"
echo "- Setup Guide: docs/STREAMING_SETUP.md"
echo "- Test UI Guide: docs/STREAMING_TEST_UI.md"
echo ""
echo "🔧 Quick test commands:"
echo "- Health check: curl http://localhost:3000/api/v2/streaming/health"
echo "- Test auth: curl -H 'x-wallet-address: 0x1234567890abcdef' http://localhost:3000/api/v2/streaming/auth/session"
echo ""
echo "Happy streaming! 🎥"

