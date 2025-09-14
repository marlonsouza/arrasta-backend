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
    if (url.expiryDate) {
      // Parse the expiry date - handle both ISO strings and date-only strings
      let expiryDate;
      
      if (url.expiryDate.includes('T')) {
        // Full ISO string with time component
        expiryDate = new Date(url.expiryDate);
      } else {
        // Date-only string (YYYY-MM-DD)
        // Set to end of day to allow the entire day
        const [year, month, day] = url.expiryDate.split('-').map(Number);
        expiryDate = new Date(year, month - 1, day, 23, 59, 59, 999);
      }
      
      const currentDate = new Date();
      
      // Log the dates for debugging
      console.log(`URL: ${shortCode}, Expiry: ${expiryDate.toISOString()}, Current: ${currentDate.toISOString()}`);
      
      if (currentDate > expiryDate) {
        console.log(`URL ${shortCode} has expired`);
        return res.status(410).send('Gone'); // Expired
      }
    }

    // Increment access number
    await incrementUrlAccess(url.id);

    // Ensure the URL has a protocol for proper redirection
    let redirectUrl = url.originalUrl;
    if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
      redirectUrl = 'http://' + redirectUrl;
    }

    // Log the redirect for debugging
    console.log(`Redirecting ${shortCode} to ${redirectUrl}`);

    res.redirect(302, redirectUrl); // 302 Redirect
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Internal Server Error');
  }
});

exports.handler = serverless(app);