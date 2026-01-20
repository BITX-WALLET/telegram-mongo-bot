// تحميل المتغيرات محليًا فقط (Railway يتجاهل .env تلقائيًا)
require("dotenv").config();

const { MongoClient } = require("mongodb");
const axios = require("axios");

// ==================
// 1️⃣ فحص المتغيرات
// ==================
const requiredVars = [
  "MONGO_URI",
  "BOT_TOKEN",
  "CHAT_ID",
  "DB_NAME",
  "COLLECTION_NAME",
];

const missing = requiredVars.filter((v) => !process.env[v]);

if (missing.length) {
  console.error("❌ Missing environment variables:", missing.join(", "));
  process.exit(1);
}

// ==================
// 2️⃣ إعداد Telegram
// ==================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: "HTML",
    });
  } catch (err) {
    console.error("❌ Telegram error:", err.message);
  }
}

// ==================
// 3️⃣ إعداد MongoDB
// ==================
const client = new MongoClient(process.env.MONGO_URI);

async function main() {
  await client.connect();

  const db = client.db(process.env.DB_NAME);
  const collection = db.collection(process.env.COLLECTION_NAME);

  console.log(
    `✅ Connected to MongoDB and watching collection: ${process.env.COLLECTION_NAME}`
  );

  // ==================
  // 4️⃣ Change Stream
  // ==================
  const changeStream = collection.watch([
    { $match: { operationType: "insert" } },
  ]);

  changeStream.on("change", async (change) => {
    const doc = change.fullDocument;
    if (!doc) return;

    // فلترة: إشعار فقط عند إيداع فعلي
    if (doc.type !== "deposit" && doc.amount <= 0) return;

    const message = `
💰 <b>New Deposit</b>

<b>Amount:</b> ${doc.amount} BTC
<b>Tx:</b> <code>${doc.hash}</code>
<b>Date:</b> ${new Date(doc.date).toLocaleString()}
`;

    await sendTelegram(message);
  });

  // ==================
  // 5️⃣ حماية من السقوط
  // ==================
  process.on("SIGINT", async () => {
    console.log("🔴 Closing MongoDB connection...");
    await client.close();
    process.exit(0);
  });
}

// ==================
// 6️⃣ تشغيل
// ==================
main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
