const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;
const MONGO_URI =
  "mongodb+srv://moizuser1:moiz123@cluster0.xwoau.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = "MoizAfterSchool";

app.use(express.json());

// Manual CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Logger Middleware
app.use((req, res, next) => {
  console.log(
    `[${new Date().toLocaleString()}] ${req.method} ${req.originalUrl}`
  );
  next();
});

// Validator Middleware for PUT
function validateLessonUpdate(req, res, next) {
  const { subject, location, price, spaces } = req.body;
  if (
    (subject && typeof subject !== "string") ||
    (location && typeof location !== "string") ||
    (price && typeof price !== "number") ||
    (spaces && typeof spaces !== "number")
  ) {
    return res.status(400).send("Invalid lesson data format");
  }
  next();
}

// Serve images
app.use("/images", (req, res) => {
  const imgPath = path.join(__dirname, "images", req.url);
  fs.stat(imgPath, (err, stat) => {
    if (err || !stat.isFile()) return res.status(404).send("Image not found");
    res.sendFile(imgPath);
  });
});

// MongoDB Setup
let db, lessons, orders;
MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
  .then((client) => {
    db = client.db(DB_NAME);
    lessons = db.collection("lessons");
    orders = db.collection("orders");
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => console.error("❌ MongoDB Error:", err));

// GET all lessons
app.get("/lessons", async (req, res) => {
  try {
    const data = await lessons.find({}).toArray();
    res.json(data);
  } catch (err) {
    res.status(500).send("Error fetching lessons");
  }
});

// GET filtered lessons (search)
app.get("/search", async (req, res) => {
  const q = req.query.q?.trim().toLowerCase() || "";
  try {
    const result = await lessons
      .find({
        $or: [
          { subject: { $regex: q, $options: "i" } },
          { location: { $regex: q, $options: "i" } },
        ],
      })
      .toArray();
    res.json(result);
  } catch {
    res.status(500).send("Error during search");
  }
});

// GET all orders
app.get("/orders", async (req, res) => {
  try {
    const data = await orders.find({}).toArray();
    res.json(data);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).send("Error fetching orders");
  }
});

// PUT lesson update
app.put("/lessons/:id", validateLessonUpdate, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await lessons.updateOne(
      { _id: new ObjectId(id) },
      { $set: req.body }
    );
    if (result.matchedCount === 0)
      return res.status(404).send("Lesson not found");
    res.send("✅ Lesson updated");
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send("Error updating lesson");
  }
});

// POST new order and update availability
app.post("/orders", async (req, res) => {
  const { name, phone, cart } = req.body;

  if (
    !name ||
    !/^[A-Za-z\s]{2,}$/.test(name) ||
    !phone ||
    !/^\d{7,15}$/.test(phone) ||
    !Array.isArray(cart) ||
    cart.length === 0
  ) {
    return res.status(400).send("Invalid order data");
  }

  try {
    const items = cart.map((item) => ({
      lessonID: new ObjectId(item._id),
      name: item.subject,
      quantity: item.quantity,
    }));

    for (const item of cart) {
      const lesson = await lessons.findOne({ _id: new ObjectId(item._id) });
      if (!lesson || lesson.spaces < item.quantity) {
        return res.status(400).send(`Not enough spaces for ${item.subject}`);
      }
      await lessons.updateOne(
        { _id: new ObjectId(item._id) },
        { $inc: { spaces: -item.quantity } }
      );
    }

    await orders.insertOne({ name, phone, items, createdAt: new Date() });
    res.status(201).send("✅ Order submitted and lessons updated");
  } catch (err) {
    console.error("Order error:", err);
    res.status(500).send("Error saving order");
  }
});

// 404 Fallback
app.use((req, res) => res.status(404).send("404 - Not Found"));

app.listen(PORT, () => {
  console.log(`🚀 Server running → http://localhost:${PORT}`);
});
