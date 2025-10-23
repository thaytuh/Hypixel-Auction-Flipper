const { default: axios } = require("axios");
const { getParsed, getProfit, splitNumber, getRawCraft } = require("./src/helperFunctions");
const { parentPort, workerData } = require("worker_threads");
const config = require("./config.json");
let minProfit = config.data.minSnipeProfit;
let minPercentProfit = config.data.minSnipePP;
let ignoredAuctions = [];
const { Item } = require("./src/Item");
const threadsToUse = require("./config.json").data["threadsToUse/speed"];
const promises = [];

console.log(`[Worker ${workerData.workerNumber}] Worker started`);

parentPort.on("message", async (message) => {
    console.log(`[Worker ${workerData.workerNumber}] Received message: ${message.type}`);
    if (message.type === "pageCount") {
        await doTask(message.data);
    } else if (message.type === "moulberry") {
        workerData.itemDatas = message.data;
        console.log(`[Worker ${workerData.workerNumber}] Updated item data`);
    }
});

async function parsePage(i) {
    console.log(`[Worker ${workerData.workerNumber}] Parsing page ${i}`);
    try {
        const auctionPage = await axios.get(`https://api.hypixel.net/v2/skyblock/auctions?page=${i}`);
        for (const auction of auctionPage.data.auctions) {
            debugCount.total++;
            debugCount.categories.add(auction.category);

            // Skip non-BIN auctions
            if (!auction.bin) {
                debugCount.binSkip++;
                continue;
            }

            const uuid = auction.uuid;
            if (ignoredAuctions.includes(uuid) || config.data.ignoreCategories[auction.category]) {
                debugCount.categorySkip++;
                continue;
            }

            const item = await getParsed(auction.item_bytes);
            const extraAtt = item["i"][0].tag.ExtraAttributes;
            const itemID = extraAtt.id;
            let startingBid = auction.starting_bid;
            const itemData = workerData.itemDatas[itemID];

            if (!itemData) {
                debugCount.noData++;
                continue;
            }

            const lbin = itemData.lbin;
            const sales = itemData.sales;
            const prettyItem = new Item(item.i[0].tag.display.Name, uuid, startingBid, auction.tier, extraAtt.enchantments,
                extraAtt.hot_potato_count > 10 ? 10 : extraAtt.hot_potato_count, extraAtt.hot_potato_count > 10 ?
                    extraAtt.hot_potato_count - 10 : 0, extraAtt.rarity_upgrades === 1,
                extraAtt.art_of_war_count === 1, extraAtt.dungeon_item_level,
                extraAtt.gems, itemID, auction.category, 0, 0, lbin, sales, auction.item_lore);

            // Set properties that the main thread expects
            prettyItem.itemID = itemID;
            prettyItem.itemName = item.i[0].tag.display.Name;
            prettyItem.auctionID = uuid;

            const unstableOrMarketManipulated = Math.abs((lbin - itemData.cleanPrice) / lbin) > config.data.maxAvgLbinDiff;
            ignoredAuctions.push(uuid);
            const rcCost = config.data.includeCraftCost ? getRawCraft(prettyItem, workerData.bazaarData, workerData.itemDatas) : 0;
            const carriedByRC = rcCost >= config.data.rawCraftMaxWeightPP * lbin;

            if (carriedByRC) {
                debugCount.rawCraftSkip++;
                continue;
            }
            if (unstableOrMarketManipulated) {
                debugCount.marketSkip++;
                continue;
            }
            if (sales <= config.data.minSales || !sales) {
                debugCount.salesSkip++;
                continue;
            }

            // Check name filter
            if (config.filters.nameFilter.find((name) => itemID.includes(name)) === undefined) {
                debugCount.profitCheck++;

                if (startingBid < lbin) {
                    const potentialProfit = lbin - startingBid;
                    console.log(`[Worker ${workerData.workerNumber}] POTENTIAL FLIP: ${itemID} | Cost: ${startingBid} | LBIN: ${lbin} | Potential: ${potentialProfit}`);

                    const profitData = getProfit(startingBid, rcCost, lbin);

                    let auctionType = "SNIPE"; // Default to SNIPE since no raw craft cost
                    if (rcCost > 0) {
                        if (rcCost > (lbin - startingBid) && profitData.snipeProfit < minProfit) {
                            auctionType = "VALUE";
                        } else if (profitData.snipeProfit >= minProfit && rcCost < (lbin - startingBid)) {
                            auctionType = "SNIPE";
                        } else if (profitData.snipeProfit >= minProfit && rcCost > 0) {
                            auctionType = "BOTH";
                        }
                    }

                    console.log(`[Worker ${workerData.workerNumber}] AUCTION TYPE: ${itemID} | Type: ${auctionType} | MinProfit: ${minProfit}`);

                    prettyItem.auctionData.ahType = auctionType;

                    if (auctionType === "VALUE" || auctionType === "BOTH") {
                        if (profitData.RCProfit > config.data.minCraftProfit && profitData.RCPP > config.data.minCraftPP) {
                            debugCount.sent++;
                            console.log(`[Worker ${workerData.workerNumber}] SENDING: ${itemID} | Profit: ${profitData.RCProfit} | Type: ${auctionType} | Sales: ${sales}`);
                            prettyItem.auctionData.profit = profitData.RCProfit;
                            prettyItem.auctionData.percentProfit = profitData.RCPP;
                            parentPort.postMessage(prettyItem);
                        } else {
                            console.log(`[Worker ${workerData.workerNumber}] ❌ VALUE/BOTH filtered: ${itemID} | RCProfit: ${profitData.RCProfit} | RCPP: ${profitData.RCPP} | MinCraft: ${config.data.minCraftProfit} | MinCraftPP: ${config.data.minCraftPP}`);
                        }
                    } else {
                        if (profitData.snipeProfit > minProfit && profitData.snipePP > minPercentProfit) {
                            debugCount.sent++;
                            console.log(`[Worker ${workerData.workerNumber}] SENDING: ${itemID} | Profit: ${profitData.snipeProfit} | Type: ${auctionType} | Sales: ${sales}`);
                            prettyItem.auctionData.profit = profitData.snipeProfit;
                            prettyItem.auctionData.percentProfit = profitData.snipePP;
                            parentPort.postMessage(prettyItem);
                        } else {
                            console.log(`[Worker ${workerData.workerNumber}] ❌ SNIPE filtered: ${itemID} | SnipeProfit: ${profitData.snipeProfit} | SnipePP: ${profitData.snipePP} | MinProfit: ${minProfit} | MinPercent: ${minPercentProfit}`);
                        }
                    }
                } else {
                    console.log(`[Worker ${workerData.workerNumber}] ❌ No profit potential: ${itemID} | Cost: ${startingBid} | LBIN: ${lbin} | Difference: ${lbin - startingBid}`);
                }
            } else {
                debugCount.nameSkip++;
            }
        }
    } catch (error) {
        console.error(`[Worker ${workerData.workerNumber}] Error parsing page ${i}:`, error);
    }

    // Log debug stats for this page
    console.log(`[Worker ${workerData.workerNumber}] Page ${i} Debug:`, {
        ...debugCount,
        categories: Array.from(debugCount.categories)
    });
}

async function doTask(totalPages) {
    console.log(`[Worker ${workerData.workerNumber}] Starting task for ${totalPages} pages`);

    // Reset counters for this auction cycle
    debugCount = {
        total: 0,
        categorySkip: 0,
        noData: 0,
        salesSkip: 0,
        nameSkip: 0,
        profitCheck: 0,
        sent: 0,
        binSkip: 0,
        marketSkip: 0,
        rawCraftSkip: 0,
        categories: new Set()
    };

    let startingPage = 0;
    const pagePerThread = splitNumber(totalPages, threadsToUse);

    if (workerData.workerNumber !== 0 && startingPage === 0) {
        const clonedStarting = pagePerThread.slice();
        clonedStarting.splice(workerData.workerNumber, 9999);
        clonedStarting.forEach((pagePer) => {
            startingPage += pagePer;
        });
    }

    let pageToStop = parseInt(startingPage) + parseInt(pagePerThread[workerData.workerNumber]);

    if (pageToStop !== totalPages) {
        pageToStop -= 1;
    }

    console.log(`[Worker ${workerData.workerNumber}] Processing pages from ${startingPage} to ${pageToStop}`);

    for (let i = startingPage; i < pageToStop; i++) {
        promises.push(parsePage(i));
    }
    await Promise.all(promises);
    console.log(`[Worker ${workerData.workerNumber}] Finished task`);

    // Log summary stats for this worker
    console.log(`[Worker ${workerData.workerNumber}] SUMMARY:`, {
        ...debugCount,
        categories: Array.from(debugCount.categories)
    });

    parentPort.postMessage("finished");
}
