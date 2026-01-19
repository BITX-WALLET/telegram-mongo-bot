const { MongoClient } = require("mongodb");
const axios = require("axios");
require("dotenv").config();

const uri = process.env.MONGO_URI;
const botToken = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const dbName = process.env.DB_NAME;
const collectionName = process.env.COLLECTION_NAME;

if (!uri || !botToken || !chatId || !dbName || !collectionName) {
  console.error("Missing .env values. Please fill all fields.");
  process.exit(1);
}

const client = new MongoClient(uri);

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const res = await axios.post(url, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    });

    if (!res.data.ok) {
      console.error("Telegram error:", res.data);
    }
  } catch (err) {
    console.error("Telegram request failed:", err.response ? err.response.data : err.message);
  }
}

async function main() {
  await client.connect();
  const db = client.db(dbName);
  const coll = db.collection(collectionName);

  console.log("Connected to MongoDB and watching collection:", collectionName);

  const changeStream = coll.watch([{ $match: { operationType: "insert" } }]);

  changeStream.on("change", (change) => {
    console.log("Change detected:", change);

    const doc = change.fullDocument;

    const hash = doc.hash || "unknown";
    const from = Array.isArray(doc.from) ? doc.from.join("\n") : doc.from || "unknown";
    const to = Array.isArray(doc.to) ? doc.to.join("\n") : doc.to || "unknown";
    const amount = doc.amount || "unknown";
    const fee = doc.feeBTC || "unknown";
    const date = doc.date ? new Date(doc.date.$date || doc.date).toLocaleString() : "unknown";

    const text = `
📌 New Transaction Detected!
🧾 Hash: ${hash}
➡️ From:
${from}
➡️ To:
${to}
💰 Amount: ${amount}
🧾 Fee: ${fee}
📅 Date: ${date}
    `;

    sendTelegram(text);
  });
}

main().catch(console.error);
