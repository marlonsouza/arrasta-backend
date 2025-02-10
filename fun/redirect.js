const express = require('express');
const serverless = require('serverless-http');
const connectToDatabase = require('../db/mongodb'); // Import the updated connectToDatabase function

const app = express();

app.get('/:shortCode', async (req, res) => {
  try {
    console.log('Request params:', req.params);
    const { client, collection } = await connectToDatabase(); // Get the client, db, and collection
    const { shortCode } = req.params;

    const url = await collection.findOne({ shortCode }); // Use collection instead of Url.findOne()
    if (!url) {
      return res.status(404).send('Not Found');
    }

    if (url.expiryDate && url.expiryDate < new Date()) {
      return res.status(410).send('Gone'); // Expired
    }

    // Update access count (using updateOne)
    await collection.updateOne({ shortCode }, { $inc: { accessNumber: 1 } });

    // Close the connection (optional but good practice)
    await client.close();

    res.redirect(302, url.originalUrl); // 302 Redirect
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

exports.handler = serverless(app);