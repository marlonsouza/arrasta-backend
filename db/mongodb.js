const { MongoClient } = require('mongodb');
require('dotenv').config();

const connectToDatabase = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    console.log('Connected to MongoDB Atlas Data API');

    const db = client.db('arrasta_db');
    const collection = db.collection('urls');

    return { client, collection };
  } catch (error) {
    console.error('MongoDB Atlas Data API connection error:', error);
    throw error;
  }
};

module.exports = connectToDatabase;