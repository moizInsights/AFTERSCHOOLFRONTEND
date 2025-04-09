const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const app = express();

app.use(express.json());

app.set('port', process.env.PORT || 3000);

// CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
  next();
});

let db;
const mongoUri = "mongodb+srv://Risith:2006vodka@cluster0.anfwr.mongodb.net/";

async function connectDB() {
  try {
    const client = await MongoClient.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    db = client.db('afterschool');
    console.log("Connected to MongoDB successfully");

    app.listen(app.get('port'), () => {
      console.log(`Server running at http://localhost:${app.get('port')}`);
    });
  } catch (err) {
    console.error("Database connection error:", err);
    process.exit(1);
  }
}

connectDB();

// Dynamically set the collection based on the collectionName parameter.
app.param('collectionName', (req, res, next, collectionName) => {
  if (!db) {
    console.error("Database not connected yet!");
    return res.status(500).json({ error: "Database connection not established yet" });
  }
  req.collection = db.collection(collectionName);
  next();
});

// Generic search route
app.get('/collection/:collectionName/search', async (req, res, next) => {
  const query = req.query.q;
  const collection = req.collection;

  try {
    // If no search query, return all
    if (!query) {
      console.log("No search query provided; fetching all documents.");
      const results = await collection.find({}).toArray();
      return res.json(results);
    }
    console.log("Search query received:", query);

    // Perform search
    const results = await collection.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    }).toArray();

    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// Generic GET
app.get('/collection/:collectionName', async (req, res, next) => {
  try {
    const results = await req.collection.find({}).toArray();
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// Serve static images if needed
app.use('/images', express.static(path.join(__dirname, 'images')));

// Generic POST
app.post('/collection/:collectionName', async (req, res, next) => {
  try {
    const result = await req.collection.insertOne(req.body);
    res.status(201).json({
      msg: 'Document inserted successfully',
      insertedId: result.insertedId
    });
  } catch (err) {
    next(err);
  }
});

// Specialized PUT for "Products" collection only
app.put('/collection/Products/:_id', async (req, res, next) => {
  try {
    const { _id } = req.params;
    const { Spaces } = req.body;
    if (!ObjectId.isValid(_id)) {
      return res.status(400).json({ msg: 'Invalid product ID.' });
    }
    if (typeof Spaces !== 'number') {
      return res.status(400).json({ msg: 'Spaces must be a number.' });
    }
    const collection = db.collection('Products');
    const result = await collection.updateOne(
      { _id: new ObjectId(_id) },
      { $set: { Spaces } }
    );
    console.log('Matched:', result.matchedCount, '| Modified:', result.modifiedCount);
    if (result.modifiedCount === 1) {
      res.json({ msg: 'Update successful', updatedId: _id });
    } else {
      res.status(404).json({ msg: 'No matching product found or no update made.' });
    }
  } catch (err) {
    console.error('Update error:', err);
    next(err);
  }
});

// Generic PUT
app.put('/collection/:collectionName/:_id', async (req, res, next) => {
  try {
    const result = await req.collection.updateOne(
      { _id: new ObjectId(req.params._id) },
      { $set: req.body },
      { upsert: false }
    );
    res.json(result.modifiedCount === 1 ? { msg: 'success' } : { msg: 'error' });
  } catch (err) {
    next(err);
  }
});

// Generic GET by _id
app.get('/collection/:collectionName/:_id', async (req, res, next) => {
  try {
    const result = await req.collection.findOne({ _id: new ObjectId(req.params._id) });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
