const express = require('express');
const mongoose = require('mongoose');
const qrcode = require('qrcode');
const serverless = require('serverless-http');
const {connectToDatabase, Url} = require('../db/mongodb'); // Import the DB connection

const app = express();
app.use(express.json());

// Wrap your async function handler
app.post('/shorten', async (req, res) => {
  console.dir('Request body:', req.body);

  try {
    await connectToDatabase();
    const { originalUrl, customAlias, expiryDate } = req.body;
    let shortCode = customAlias || generateShortCode();

    const qrCodeDataURL = await qrcode.toDataURL(`${process.env.BASE_URL}/${shortCode}`);

    const newUrl = new Url({
      originalUrl,
      shortCode,
      customAlias,
      expiryDate,
      createdAt: new Date(),
      accessNumber: 0,
    });

    await newUrl.save();
    mongoose.connection.close();

    res.json({ shortUrl: `${process.env.BASE_URL}/${shortCode}`, qrCode: qrCodeDataURL, expiryDate, accessNumber: newUrl.accessNumber });
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