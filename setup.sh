#!/bin/bash

# Hypixel Auction Flipper Setup Script
echo "🚀 Hypixel Auction Flipper Setup"
echo "================================="

# Check if .env already exists
if [ -f .env ]; then
    echo "✅ .env file already exists"
    read -p "Do you want to reset it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp .env.example .env
        echo "✅ .env file reset from template"
    fi
else
    cp .env.example .env
    echo "✅ .env file created from template"
fi

echo ""
echo "📝 Next steps:"
echo "1. Edit the .env file with your Discord webhook URL"
echo "2. Run 'npm start' to start the bot"
echo ""
echo "💡 To get your Discord webhook URL:"
echo "   - Go to Discord Server → Server Settings → Integrations"
echo "   - Click 'Webhooks' → 'New Webhook'"
echo "   - Choose your channel and copy the webhook URL"
echo ""
echo "🔧 Environment variables in .env:"
echo "   DISCORD_WEBHOOK_URL=your_webhook_url_here"
echo "   WEBHOOK_NAME=Skyblock Flipper"
echo "   WEBHOOK_AVATAR=https://hypixel.net/attachments/512xnewhypixel-png.2304900/"
echo "   VERBOSE_LOGGING=false"
