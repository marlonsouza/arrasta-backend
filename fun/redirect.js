const express = require('express');
const serverless = require('serverless-http');
const { connectToDatabase, getUrlByShortCode, incrementUrlAccess } = require('../db/firebase');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/:shortCode', async (req, res) => {
  try {
    await connectToDatabase();
    const { shortCode } = req.params;

    // Fetch the URL data from Firebase
    const url = await getUrlByShortCode(shortCode);

    if (!url) {
      return res.status(404).send('Not Found');
    }

    if (url.expiryDate && new Date(url.expiryDate) < new Date()) {
      return res.status(410).send('Gone'); // Expired
    }

    // Increment access number
    await incrementUrlAccess(url.id);

    res.redirect(302, url.originalUrl); // 302 Redirect
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

exports.handler = serverless(app);