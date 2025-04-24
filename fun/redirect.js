const express = require('express');
const serverless = require('serverless-http');
const connectToDatabase = require('../db/mongodb');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/:shortCode', async (req, res) => {
  try {
    const { client, urlCollection } = await connectToDatabase();
    const { shortCode } = req.params;

    // Fetch the URL data from MongoDB
    const url = await urlCollection.findOne({ shortCode });

    if (!url) {
      return res.status(404).send('Not Found');
    }

    if (url.expiryDate && new Date(url.expiryDate) < new Date()) {
      return res.status(410).send('Gone'); // Expired
    }

    // Increment access number
    await urlCollection.updateOne(
      { _id: url._id },
      { $inc: { accessNumber: 1 } }
    );

    res.redirect(302, url.originalUrl); // 302 Redirect
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

exports.handler = serverless(app);