#!/bin/bash

# Quick PM2 Setup and Start Script
echo "🚀 Hypixel Auction Flipper - PM2 Setup"
echo "====================================="

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 not found. Installing..."
    npm install -g pm2
    echo "✅ PM2 installed"
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Creating from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo "⚠️  Please edit .env file with your Discord webhook URL before starting"
    exit 1
fi

# Check if webhook URL is configured
if grep -q "YOUR_WEBHOOK_ID" .env; then
    echo "⚠️  Please edit .env file and replace YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN"
    echo "   with your actual Discord webhook URL"
    exit 1
fi

echo "✅ Environment configured"
echo "🚀 Starting bot with PM2..."

# Start with PM2
pm2 start ecosystem.config.js

echo ""
echo "🎉 Bot started successfully!"
echo "📊 Check status: pm2 status"
echo "📝 View logs: pm2 logs auction-flipper"
echo "🖥️  Monitor: pm2 monit"
echo ""
echo "🛑 To stop: pm2 stop auction-flipper"
echo "🔄 To restart: pm2 restart auction-flipper"
