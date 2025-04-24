const express = require('express');
const qrcode = require('qrcode');
const serverless = require('serverless-http');
const { connectToDatabase } = require('../db/mongodb');
const cors = require('cors');

const Url = require('../model/url');

const app = express();
app.use(express.json());
app.use(cors());

// Wrap your async function handler
app.post('/shorten', async (req, res) => {
  try {
    const { urlCollection } = await connectToDatabase();
    const { originalUrl, customAlias, expiryDate } = req.body;
    let shortCode = customAlias || generateShortCode();

    // Check if shortCode already exists
    const existingUrl = await urlCollection.findOne({ shortCode });
    if (existingUrl) {
      return res.status(400).json({ error: 'Custom alias already exists' });
    }

    const qrCodeDataURL = await qrcode.toDataURL(`${process.env.BASE_URL}/${shortCode}`);

    const newUrl = new Url(originalUrl, customAlias, expiryDate, shortCode, qrCodeDataURL);
    
    // Insert the new URL into MongoDB
    const result = await urlCollection.insertOne(newUrl);
    
    // Get the inserted document
    const url = await urlCollection.findOne({ _id: result.insertedId });

    res.json({
      shortUrl: `${process.env.BASE_URL}/${url.shortCode}`,
      qrCode: qrCodeDataURL,
      expiryDate: url.expiryDate,
      accessNumber: url.accessNumber
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to shorten URL' });
  }
});

// Implement generateShortCode() function (random string generator)
function generateShortCode() {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) { // Adjust length as needed
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Export the handler for Netlify
exports.handler = serverless(app);