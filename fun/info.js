const express = require('express');
const serverless = require('serverless-http');
const connectToDatabase = require('../db/mongodb');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/info/:shortCode', async (req, res) => {
  try {
    const { client, urlCollection } = await connectToDatabase();
    const { shortCode } = req.params;

    // Fetch the URL data from MongoDB
    const url = await urlCollection.findOne({ shortCode });

    if (!url) {
      return res.status(404).json({ error: 'Not Found' });
    }
    
    res.json(url);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

exports.handler = serverless(app);