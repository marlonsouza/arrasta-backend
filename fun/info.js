const express = require('express');
const mongoose = require('mongoose');
const serverless = require('serverless-http');
const { connectToDatabase, Url } = require('../db/mongodb');

const app = express();

app.get('/info/:shortCode', async (req, res) => {
  try {
    await connectToDatabase();
    const { shortCode } = req.params;

    const url = await Url.findOne({ shortCode });

    if (!url) {
      return res.status(404).json({ error: 'Not Found' }); // Return JSON for consistency
    }

    const info = {
      originalUrl: url.originalUrl,
      customAlias: url.customAlias,
      expiryDate: url.expiryDate,
      createdAt: url.createdAt,
      accessNumber: url.accessNumber || 0,
    };

    mongoose.connection.close() // Close the connection after use

    res.json(info); // Return the info as JSON
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' }); // Consistent JSON error response
  }
});

exports.handler = serverless(app);