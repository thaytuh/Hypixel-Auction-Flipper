# 🚀 Hypixel Auction House Flipper

An advanced Discord bot that automatically scans the Hypixel Skyblock auction house for profitable flips and sends notifications directly to your Discord server.

![Bot Status](https://img.shields.io/badge/Status-Active-success)
![Version](https://img.shields.io/badge/Version-0.6.9-blue)
![Discord](https://img.shields.io/badge/Discord-Ready-5865F2)

## ✨ Features

- **🔍 Real-time Auction Scanning** - Monitors all Hypixel auction house pages simultaneously using 48 threads
- **💰 Profit Analysis** - Calculates both fixed coin profit and percentage profit margins
- **🏭 Raw Craft Cost Calculation** - Automatically calculates material costs for enchanted books and crafted items
- **📊 Advanced Filtering** - Multiple filter layers (categories, names, enchantments, sales volume)
- **📱 Discord Integration** - Rich embed notifications with item thumbnails and detailed profit info
- **⚡ High Performance** - Processes thousands of auctions per minute
- **🔒 Security** - Environment variable configuration for sensitive data

## 📋 Requirements

- Node.js 18+ or higher
- A Discord webhook URL (for notifications)
- Hypixel Skyblock auction data access

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/yourusername/Hypixel-Auction-Flipper.git
cd Hypixel-Auction-Flipper
npm install
```

### 2. Environment Setup
```bash
# Option 1: Use the setup script (recommended)
./setup.sh

# Option 2: Manual setup
cp .env.example .env
nano .env  # Edit with your Discord webhook URL
```

### 3. Configure Bot Settings
Edit `config.json` to customize **bot behavior settings** (profit thresholds, filters, etc.):

**Note:** Discord webhook configuration is now handled via environment variables in the `.env` file, not in `config.json`.

### 4. Run the Bot
```bash
npm start
```

## ⚙️ Configuration

### Environment Variables (`.env`)
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
WEBHOOK_NAME=Flipper
WEBHOOK_AVATAR=https://hypixel.net/attachments/512xnewhypixel-png.2304900/
```

### Bot Settings (`config.json`)

#### Profit Requirements
```json
{
  "minSnipeProfit": 600000,     // Minimum 600k coins profit for snipe auctions
  "minAvgProfit": 500000,       // Minimum 500k coins profit vs average price
  "minCraftProfit": 500000,     // Minimum 500k coins profit for crafted items
  "minSnipePP": 8,              // Minimum 8% profit for snipe auctions
  "minCraftPP": 8               // Minimum 8% profit for crafted items
}
```

#### Filters
```json
{
  "ignoreCategories": {
    "weapon": false,        // ❌ Scan weapons
    "accessories": true,    // ✅ Ignore accessories
    "armor": false,         // ❌ Scan armor
    "misc": false,          // ❌ Scan misc items
    "blocks": false,        // ❌ Scan blocks
    "consumables": true     // ✅ Ignore consumables
  },
  "minSales": 4,            // Minimum 4 sales per day
  "includeCraftCost": true  // Calculate raw material costs
}
```

## 📱 Discord Setup

### 1. Create a Webhook
1. Go to your Discord server
2. Server Settings → Integrations → Webhooks
3. "New Webhook" → Choose your channel
4. Copy the webhook URL

### 2. Configure Bot
Add your webhook URL to the `.env` file:
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abcdef123456
```

### 3. Customize Appearance
```env
WEBHOOK_NAME=Skyblock Flipper
WEBHOOK_AVATAR=https://hypixel.net/attachments/512xnewhypixel-png.2304900/
```

## 🎯 How It Works

### Auction Types
- **🔫 SNIPE** - Buy underpriced auctions, sell at market price
- **💎 VALUE** - Craft items using raw materials, sell for profit
- **🔄 BOTH** - Items profitable both as snipes and crafted

### Profit Calculations
```javascript
// Snipe Profit = (Market Price - Auction Price) - 2% AH Tax
// Craft Profit = (Market Price - Material Cost) - 2% AH Tax
// Percentage = (Profit / Market Price) * 100
```

### Filter System
1. **Category Filter** - Skip unwanted item types
2. **Name Filter** - Block specific items (SALMON, PERFECT, etc.)
3. **Enchantment Filter** - Reduce value of over-enchanted items
4. **Sales Filter** - Only items with sufficient daily sales
5. **Price Filter** - Only expensive items get crafting cost calculation

## 📊 Example Notification

```
💎 Aspect of the Dragons
💰 Profit: 2.3M (12.4%)
📦 Cost: 16.2M
🏷️ LBIN: 18.5M
📊 Sales/Day: 8
🎯 Type: SNIPE
📈 Avg Price: 17.1M
```

## 🔧 Advanced Features

### Raw Craft Cost Calculation
When enabled, the bot calculates material costs for:
- **Enchanted Books** - Based on enchantment type and level
- **Hot Potato Books** - Applied to weapons/armor/accessories
- **Recombobulators** - For rarity upgrades
- **Art of War** - For weapon enhancement

### Performance Optimization
- **48 Parallel Threads** - Maximum scanning speed
- **Smart Caching** - Reduces API calls
- **Rate Limiting** - Respects Hypixel API limits
- **Error Recovery** - Continues running despite failures

## 🚨 Troubleshooting

### Common Issues
- **No notifications** - Check profit thresholds and filters
- **Discord errors** - Verify webhook URL and permissions
- **Slow performance** - Reduce thread count in config
- **API errors** - Check Hypixel API status

### Debug Mode
Set `VERBOSE_LOGGING = true` in `index.js` for detailed logs.

## 📝 Changelog

### v0.6.9
- ✅ Fixed Discord webhook integration (switched to axios)
- ✅ Added environment variable support
- ✅ Improved error handling and logging
- ✅ Enhanced profit calculation accuracy
- ✅ Added comprehensive filtering system

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

---

**Made with ❤️ for the Hypixel Skyblock community** 
