const {Client, fql } = require('fauna');
require('dotenv').config();

const connectToDatabase = async () => {
  try {
    const secret = process.env.FAUNA_KEY;
    const client = new Client({
        endpoint: new URL(process.env.FAUNA_ENDPOINT ?? "https://db.fauna.com"),
        secret // Use your FaunaDB secret key
    });

    console.log('Connected to FaunaDB');

    return client; // Return the client and the q object for queries
  } catch (error) {
    console.error('FaunaDB connection error:', error);
    throw error;
  }
};

module.exports = connectToDatabase;