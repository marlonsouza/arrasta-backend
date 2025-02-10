const express = require('express');
const serverless = require('serverless-http');
const connectToDatabase = require('../db/mongodb'); // Import the updated connectToDatabase function

const app = express();

app.get('/info/:shortCode', async (req, res) => {
  try {
    const { client, collection } = await connectToDatabase(); // Get the client and collection
    const { shortCode } = req.params;

    const url = await collection.findOne({ shortCode }); // Use collection.findOne()

    if (!url) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const info = {
      originalUrl: url.originalUrl,
      customAlias: url.customAlias,
      expiryDate: url.expiryDate,
      createdAt: url.createdAt,
      accessNumber: url.accessNumber || 0, // Provide a default value if accessNumber is not present
    };

    // Close the connection (optional but good practice)
    await client.close();

    res.json(info);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

exports.handler = serverless(app);