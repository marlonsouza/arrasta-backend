const express = require('express');
const mongoose = require('mongoose');
const serverless = require('serverless-http');
const { Url, connectToDatabase } = require('../db/mongodb');

const app = express();

app.get('/:shortCode', async (req, res) => { // Dynamic route for short codes
  try {
    console.log('Request params:', req.params);
    await connectToDatabase();
    const { shortCode } = req.params;

    const url = await Url.findOne({ shortCode });
    if (!url) {
      return res.status(404).send('Not Found');
    }

    if (url.expiryDate && url.expiryDate < new Date()) {
      return res.status(410).send('Gone'); // Expired
    }

    url.accessNumber += 1;
    await url.save();

    mongoose.connection.close() // Close the connection after use

    res.redirect(302, url.originalUrl); // 302 Redirect
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

exports.handler = serverless(app);