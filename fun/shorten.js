const express = require('express');
const qrcode = require('qrcode');
const serverless = require('serverless-http');
const connectToDatabase = require('../db/faunadb');
const cors = require('cors');

const Url = require('../model/url');
const { fql } = require('fauna');

const app = express();
app.use(express.json());
app.use(cors());

const urlResponse = fql`
  url {
    originalUrl,
    customAlias,
    expiryDate,
    createdAt,
    accessNumber,
    shortCode
  }
`;

// Wrap your async function handler
app.post('/shorten', async (req, res) => {
  try {
    const client = await connectToDatabase();
    const { originalUrl, customAlias, expiryDate } = req.body;
    let shortCode = customAlias || generateShortCode();

    const qrCodeDataURL = await qrcode.toDataURL(`${process.env.BASE_URL}/${shortCode}`);

    const newUrl = new Url(originalUrl, customAlias, expiryDate, shortCode, qrCodeDataURL);

    const { data: url } = await client.query(
      fql`let url: Any = Url.create(${newUrl});
      ${urlResponse}`);

    res.json({
      shortUrl: `${process.env.BASE_URL}/${url.shortCode}`,
      qrCode: qrCodeDataURL,
      expiryDate: url.expiryDate,
      accessNumber: url.accessNumber
    });
  } catch (error) {
    console.error(error);

    // Check for uniqueness constraint violation (duplicate short code or alias)
    if (error.message.includes('instance already exists')) {
      return res.status(400).json({ error: 'Custom alias already exists' });
    }

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