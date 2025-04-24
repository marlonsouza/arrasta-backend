const express = require('express');
const qrcode = require('qrcode');
const serverless = require('serverless-http');
const { connectToDatabase, createUrl, getUrlByShortCode } = require('../db/firebase');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const Url = require('../model/url');

const app = express();
app.use(express.json());
app.use(cors());

// Configure Express to trust the proxy
app.set('trust proxy', 1);

// Create a limiter that allows 10 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use a custom key generator that doesn't rely on IP
  keyGenerator: (req) => {
    // Use a combination of headers that might identify the user
    // This is a fallback when IP is not available
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.headers['cf-connecting-ip'] || 
           'unknown';
  }
});

// Apply rate limiting to all routes
app.use(limiter);

// Wrap your async function handler
app.post('/shorten', async (req, res) => {
  try {
    await connectToDatabase();
    const { originalUrl, customAlias, expiryDate } = req.body;
    let shortCode = customAlias || generateShortCode();

    // Check if shortCode already exists
    const existingUrl = await getUrlByShortCode(shortCode);
    if (existingUrl) {
      return res.status(400).json({ error: 'Custom alias already exists' });
    }

    const qrCodeDataURL = await qrcode.toDataURL(`${process.env.BASE_URL}/${shortCode}`);

    const newUrl = new Url(originalUrl, customAlias, expiryDate, shortCode, qrCodeDataURL);
    
    // Insert the new URL into Firebase
    const url = await createUrl(newUrl);

    res.json({
      shortUrl: `${process.env.BASE_URL}/${url.shortCode}`,
      qrCode: url.qrCodeDataURL,
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