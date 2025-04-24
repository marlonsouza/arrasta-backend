const { MongoClient } = require('mongodb');
require('dotenv').config();

let client = null;
let urlCollection = null;
let paymentCollection = null;

const connectToDatabase = async () => {
  try {
    if (!client) {
      const options = {
        tls: true,
        retryWrites: true,
        w: 'majority',
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
      };

      client = new MongoClient(process.env.MONGODB_URI, options);
      await client.connect();
      console.log('MongoDB connection successful!');

      const db = client.db('arrasta');
      urlCollection = db.collection('urls');
      paymentCollection = db.collection('payments');
    }

    return { urlCollection, paymentCollection };
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

const closeConnection = async () => {
  if (client) {
    await client.close();
    client = null;
    urlCollection = null;
    paymentCollection = null;
    console.log('MongoDB connection closed.');
  }
};

module.exports = {
  connectToDatabase,
  closeConnection,
  getUrlCollection: () => urlCollection,
  getPaymentCollection: () => paymentCollection
};