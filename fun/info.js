const express = require('express');
const serverless = require('serverless-http');
const connectToDatabase = require('../db/faunadb'); // Import the FaunaDB connection
const { fql } = require('fauna');

const app = express();

const urlResponse = fql`
  url {
    originalUrl,
    customAlias,
    expiryDate,
    createdAt,
    accessNumber
  }
`;

app.get('/info/:shortCode', async (req, res) => {
  try {
    const client = await connectToDatabase();
    const { shortCode } = req.params;

    // Fetch the URL data from FaunaDB
    const {data: url} = await client.query(
      fql`let url: Any = Url.byShortCode(${shortCode}).first()${urlResponse}`
    );

    if (!url) {
      return res.status(404).json({ error: 'Not Found' });
    }
    
    res.json(url);
  } catch (error) {
    console.error(error);

    // Check if the error is due to the URL not being found
    if (error.message === 'instance not found') {
      return res.status(404).json({ error: 'Not Found' });
    }

    res.status(500).json({ error: 'Internal Server Error' });
  }
});

exports.handler = serverless(app);