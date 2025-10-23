require('dotenv').config();
const { default: axios } = require("axios");
const config = require("./config.json");
// Removed discord.js import since we're using axios for webhooks
const { Worker } = require("worker_threads");
const { asyncInterval, addNotation } = require("./src/helperFunctions");

const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';

let threadsToUse = config.data["threadsToUse/speed"] ?? 1;
let lastUpdated = 0;
let doneWorkers = 0;
let startingTime;
let maxPrice = 0;
let itemDatas = {};
const workers = [];
const webhookRegex =
  /^https:\/\/discord\.com\/api\/webhooks\/(\d+)\/([A-Za-z0-9_-]+)$/;

const bazaarPrice = {
  RECOMBOBULATOR_3000: 0,
  HOT_POTATO_BOOK: 0,
  FUMING_POTATO_BOOK: 0,
};

// Rate limiting protection for Discord webhooks
let lastWebhookSend = 0;
const WEBHOOK_COOLDOWN = 1000; // 1 second between webhook sends

async function sendWebhookSafely(webhook, content) {
  try {
    // Use axios instead of discord.js for webhook sending
    const webhookUrl = `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;

    // Rate limiting check
    const now = Date.now();
    if (now - lastWebhookSend < WEBHOOK_COOLDOWN) {
      await new Promise((resolve) =>
        setTimeout(resolve, WEBHOOK_COOLDOWN - (now - lastWebhookSend))
      );
    }

    const response = await axios.post(webhookUrl, content, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    lastWebhookSend = Date.now();
    return response.status === 204; // Discord returns 204 No Content on success
  } catch (error) {
    console.error(
      `[Discord] Webhook failed:`,
      error.response?.status || error.code,
      error.response?.data?.message || error.message
    );

    if (error.response?.status === 404) {
      console.error(`[Discord] Webhook not found - check your webhook URL`);
    } else if (error.response?.status === 403) {
      console.error(`[Discord] Missing permissions - check webhook permissions`);
    } else if (error.response?.status === 405) {
      console.error(`[Discord] Method not allowed - webhook may be disabled`);
    }
    return false;
  }
}

async function initialize() {
  // Validate environment variables
  if (!process.env.DISCORD_WEBHOOK_URL) {
    console.log(`[Main thread] ❌ DISCORD_WEBHOOK_URL not found in environment variables`);
    console.log(`[Main thread] Please create a .env file based on .env.example`);
    return;
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const matches = webhookUrl.match(webhookRegex);

  if (!matches) {
    console.log(`[Main thread] ❌ Invalid webhook URL format in DISCORD_WEBHOOK_URL`);
    console.log(`[Main thread] Expected: https://discord.com/api/webhooks/{id}/{token}`);
    console.log(`[Main thread] Your URL: ${webhookUrl}`);
    return;
  }

  const webhookId = matches[1];
  const webhookToken = matches[2];

  // Validate webhook ID and token format
  if (
    !webhookId ||
    !webhookToken ||
    webhookId.length < 17 ||
    webhookToken.length < 20
  ) {
    console.log(`[Main thread] ❌ Invalid webhook ID or token format`);
    return;
  }

  const webhook = { id: webhookId, token: webhookToken };
  console.log(`[Main thread] ✅ Discord webhook initialized: ${webhookId}`);

  // Test webhook connectivity on startup
  if (config.data.discordEnabled) {
    try {
      await sendWebhookSafely(webhook, {
        username: process.env.WEBHOOK_NAME || 'Flipper',
        avatar_url: process.env.WEBHOOK_AVATAR || 'https://hypixel.net/attachments/512xnewhypixel-png.2304900/',
        content: `🤖 Bot started! Ready to find flips...`,
      });
      console.log(`[Main thread] ✅ Discord webhook test successful`);
    } catch (error) {
      console.log(
        `[Main thread] ⚠️ Discord webhook test failed, but continuing...`
      );
      console.log(`[Main thread] Error: ${error.message}`);
    }
  }

  // Cleanup on process exit (no webhook.destroy() needed for axios)
  process.on("SIGINT", () => {
    console.log(`[Main thread] Shutting down...`);
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log(`[Main thread] Shutting down...`);
    process.exit(0);
  });

  // Configuration summary
  if (VERBOSE_LOGGING) {
    console.log(`\n🚀 Auction Flipper Configuration:`);
    console.log(`   📊 Threads: ${threadsToUse}`);
    console.log(
      `   💰 Min Profit: ${config.data.minSnipeProfit.toLocaleString()}`
    );
    console.log(`   📈 Min Sales: ${config.data.minSales}`);
    console.log(
      `   🔧 Raw Craft: ${config.data.includeCraftCost ? "Enabled" : "Disabled"}`
    );
    console.log(
      `   📱 Discord: ${config.data.discordEnabled ? "Enabled" : "Disabled"}`
    );
    console.log(`   🎯 Categories: All enabled`);
    console.log(`   📋 Name Filter: Only 'SALMON' filtered\n`);
  }

  await getBzData();
  await getMoulberry();
  await getLBINs();

  for (let j = 0; j < threadsToUse; j++) {
    workers[j] = new Worker("./AuctionHandler.js", {
      workerData: {
        itemDatas: itemDatas,
        bazaarData: bazaarPrice,
        workerNumber: j,
        maxPrice: maxPrice,
      },
    });

    workers[j].on("message", async (result) => {
      if (result.itemID !== undefined) {
        let averagePrice = itemDatas[result.itemID]?.cleanPrice || "N/A";

        // Only log detailed info if verbose logging is enabled
        if (VERBOSE_LOGGING) {
          console.log(
            `[Main] Received flip candidate: ${result.itemID} | Profit: ${result.auctionData.profit} | LBIN: ${result.auctionData.lbin} | Cost: ${result.auctionData.price}`
          );
        }

        if (
          result.auctionData.lbin - result.auctionData.price >=
            config.data.minSnipeProfit &&
          averagePrice - result.auctionData.price >= config.data.minAvgProfit
        ) {
          let mustBuyMessage = "";
          console.log(`[Main] Sending Discord webhook for: ${result.itemID}`);

          // Check if Discord is enabled
          if (!config.data.discordEnabled) {
            if (VERBOSE_LOGGING) {
              console.log(
                `[Main] Discord disabled in config, skipping webhook send`
              );
            }
            return;
          }

          // Simplified embed to avoid Discord limits
          const embed = {
            title: `💎 ${result.itemData.name.replace(/§./g, "")}`,
            color: 0x00ff00,
            thumbnail: { url: `https://sky.shiiyu.moe/item/${result.itemID}` },
            fields: [
              {
                name: "💰 Profit",
                value: `${addNotation(
                  "oneLetters",
                  result.auctionData.profit
                )} (${result.auctionData.percentProfit}%)`,
                inline: true,
              },
              {
                name: "📦 Cost",
                value: addNotation("oneLetters", result.auctionData.price),
                inline: true,
              },
              {
                name: "🏷️ LBIN",
                value: addNotation("oneLetters", result.auctionData.lbin),
                inline: true,
              },
              {
                name: "📊 Sales/Day",
                value: addNotation("oneLetters", result.auctionData.sales),
                inline: true,
              },
              {
                name: "🎯 Type",
                value: result.auctionData.ahType,
                inline: true,
              },
              {
                name: "📈 Avg Price",
                value: addNotation("oneLetters", averagePrice),
                inline: true,
              },
            ],
            footer: { text: `Auction ID: ${result.auctionID}` },
            timestamp: new Date().toISOString(),
          };

          const success = await sendWebhookSafely(webhook, {
            username: process.env.WEBHOOK_NAME || 'Flipper',
            avatar_url: process.env.WEBHOOK_AVATAR || 'https://hypixel.net/attachments/512xnewhypixel-png.2304900/',
            embeds: [embed],
          });

          if (success) {
            console.log(
              `[Main] ✅ Discord webhook sent successfully for: ${result.itemID}`
            );
          }
        } else {
          if (VERBOSE_LOGGING) {
            console.log(
              `[Main] ❌ Flip filtered out - doesn't meet min profit requirements: ${result.itemID}`
            );
          }
        }
      } else if (result === "finished") {
        doneWorkers++;
        if (doneWorkers === threadsToUse) {
          doneWorkers = 0;
          const completionTime = ((Date.now() - startingTime) / 1000);

          if (VERBOSE_LOGGING) {
            console.log(`Completed in ${completionTime} seconds`);
          }

          console.log(
            `[Main] ✅ Auction cycle complete - check Discord for new flip notifications!`
          );
          startingTime = 0;
          workers[0].emit("done");
        }
      }
    });
  }

  asyncInterval(
    async () => {
      await getLBINs();
      workers.forEach((worker) => {
        worker.postMessage({ type: "moulberry", data: itemDatas });
      });
    },
    "lbin",
    60000
  );

  asyncInterval(
    async () => {
      await getMoulberry();
      workers.forEach((worker) => {
        worker.postMessage({ type: "moulberry", data: itemDatas });
      });
    },
    "avg",
    60e5
  );

  asyncInterval(
    async () => {
      return new Promise(async (resolve) => {
        const ahFirstPage = await axios.get(
          "https://api.hypixel.net/v2/skyblock/auctions?page=0"
        );
        const totalPages = ahFirstPage.data.totalPages;
        if (ahFirstPage.data.lastUpdated === lastUpdated) {
          resolve();
        } else {
          lastUpdated = ahFirstPage.data.lastUpdated;
          startingTime = Date.now();

          if (VERBOSE_LOGGING) {
            console.log("Getting auctions..");
          }

          workers.forEach((worker) => {
            worker.postMessage({ type: "pageCount", data: totalPages });
          });
          workers[0].once("done", () => {
            resolve();
          });
        }
      });
    },
    "check",
    0
  );
}

async function getLBINs() {
  const lbins = await axios.get("https://moulberry.codes/lowestbin.json");
  const lbinData = lbins.data;
  for (const item of Object.keys(lbinData)) {
    if (!itemDatas[item]) itemDatas[item] = {};
    itemDatas[item].lbin = lbinData[item];
  }
}

async function getMoulberry() {
  const moulberryAvgs = await axios.get(
    "https://moulberry.codes/auction_averages/3day.json"
  );
  const avgData = moulberryAvgs.data;

  const cleanPriceAvgs = await axios.get(
    "https://moulberry.codes/auction_averages_lbin/1day.json"
  );
  const cleanPriceData = cleanPriceAvgs.data;

  for (const item of Object.keys(avgData)) {
    if (!itemDatas[item]) itemDatas[item] = {};
    const itemInfo = avgData[item];

    itemDatas[item].sales = itemInfo.sales !== undefined ? itemInfo.sales : 0;
    itemDatas[item].cleanPrice =
      cleanPriceData[item] !== undefined
        ? Math.round(cleanPriceData[item])
        : itemInfo.clean_price !== undefined
        ? itemInfo.clean_price
        : itemInfo.price;
  }
}

async function getBzData() {
  const bzData = await axios.get("https://api.hypixel.net/v2/skyblock/bazaar");
  bazaarPrice["RECOMBOBULATOR_3000"] =
    bzData.data.products.RECOMBOBULATOR_3000.quick_status.buyPrice;
  bazaarPrice["HOT_POTATO_BOOK"] =
    bzData.data.products.HOT_POTATO_BOOK.quick_status.buyPrice;
  bazaarPrice["FUMING_POTATO_BOOK"] =
    bzData.data.products.FUMING_POTATO_BOOK.quick_status.buyPrice;

  if (VERBOSE_LOGGING) {
    console.log(`[Main] Bazaar data loaded:`, bazaarPrice);
  }
}

initialize();
