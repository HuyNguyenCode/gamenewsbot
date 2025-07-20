const RSSParser = require("rss-parser");
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");

const parser = new RSSParser();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// 🕹️ Các nguồn tin tức game uy tín
const RSS_FEEDS = [
  "https://feeds.feedburner.com/ign/all",               // IGN (OK)
  "https://kotaku.com/rss",                             // Kotaku
  "https://www.gamespot.com/feeds/news/",               // GameSpot
  "https://feeds.feedburner.com/Polygon",               // Polygon
  "https://www.pcgamer.com/rss/",                       // PC Gamer
  "https://www.nintendolife.com/feeds/latest",          // Nintendo Life
  "https://www.pushsquare.com/feeds/latest",            // PlayStation news
  "https://news.xbox.com/en-us/feed/",                  // Xbox Wire (thay thế XboxAchievements)
];

const CHANNEL_ID = "909332386846748672"; // <-- THAY BẰNG ID KÊNH DISCORD

let lastItems = {};
let queue = [];
let sentToday = 0;

// Lấy tin mới → đưa vào hàng đợi
async function fetchFeeds() {
  console.log("🎮 Fetching game news...");
  for (let feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      if (feed.items && feed.items.length) {
        const latest = feed.items[0];
        if (lastItems[feedUrl] !== latest.link) {
          lastItems[feedUrl] = latest.link;
          queue.push({
            title: latest.title,
            link: latest.link,
          });
          console.log(`🆕 New game article queued: ${latest.title}`);
        }
      }
    } catch (err) {
      console.error(`❌ Error parsing ${feedUrl}:`, err.message);
    }
  }
}

// Gửi từng bài trong hàng đợi
async function processQueue() {
  if (queue.length === 0) {
    console.log("⏸ Queue empty, waiting...");
    return;
  }
  if (sentToday >= 10) {
    console.log("🚦 Daily limit reached, skipping until tomorrow.");
    return;
  }

  try {
    const item = queue.shift();
    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel.permissionsFor(client.user).has("SendMessages")) {
      console.error("❌ Missing permission to send messages.");
      return;
    }

    await channel.send(`🕹️ **${item.title}**\n🔗 ${item.link}`);
    sentToday++;
    console.log(`✅ Sent: ${item.title}`);
  } catch (err) {
    console.error("❌ Failed to send message:", err.message);
  }
}

// Reset mỗi ngày
function scheduleDailyReset() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setUTCHours(0, 0, 0, 0);
  nextMidnight.setUTCDate(now.getUTCDate() + 1);
  const msUntilReset = nextMidnight - now;
  setTimeout(() => {
    sentToday = 0;
    console.log("🔄 Daily counter reset.");
    scheduleDailyReset();
  }, msUntilReset);
}

// Gửi bài theo delay random
const min = 5, max = 10;
async function scheduleNextSend() {
  await processQueue();
  const delay = (Math.floor(Math.random() * (max - min + 1)) + min) * 60000;
  console.log(`⏳ Next article in ${delay / 60000} minutes`);
  setTimeout(scheduleNextSend, delay);
}

// Khởi động bot
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  fetchFeeds();
  scheduleDailyReset();
  setInterval(fetchFeeds, 30 * 60 * 1000);
  scheduleNextSend();
});
client.login(process.env.BOT_TOKEN);

const app = express();
const port = process.env.PORT || 3000;
app.get("/", (req, res) => res.status(200).send("✅ Bot is alive!"));
app.listen(port, () => console.log(`✅ HTTP server on port ${port}`));
