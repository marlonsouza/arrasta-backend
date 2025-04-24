const express = require('express');
const serverless = require('serverless-http');
const { connectToDatabase, getUrlByShortCode } = require('../db/firebase');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
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