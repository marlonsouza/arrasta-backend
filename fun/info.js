const express = require('express');
const serverless = require('serverless-http');
const { connectToDatabase, getUrlByShortCode } = require('../db/firebase');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/info/:shortCode', async (req, res) => {
  try {
    await connectToDatabase();
    const { shortCode } = req.params;

    // Fetch the URL data from Firebase
    const url = await getUrlByShortCode(shortCode);

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