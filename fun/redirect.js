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

    // Check if the URL has expired
    // Only check if expiryDate exists and is not null/undefined
    if (url.expiryDate) {
      const expiryDate = new Date(url.expiryDate);
      const currentDate = new Date();
      
      // Log the dates for debugging
      console.log(`URL: ${shortCode}, Expiry: ${expiryDate}, Current: ${currentDate}`);
      
      if (expiryDate < currentDate) {
        console.log(`URL ${shortCode} has expired`);
        return res.status(410).send('Gone'); // Expired
      }
    }

    // Increment access number
    await incrementUrlAccess(url.id);

    // Log the redirect for debugging
    console.log(`Redirecting ${shortCode} to ${url.originalUrl}`);
    
    res.redirect(302, url.originalUrl); // 302 Redirect
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Internal Server Error');
  }
});

exports.handler = serverless(app);