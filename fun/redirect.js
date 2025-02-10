const express = require('express');
const serverless = require('serverless-http');
const connectToDatabase = require('../db/faunadb'); // Import the FaunaDB connection
const { fql } = require('fauna');

const app = express();

const urlResponse = fql`
  url {
    id,
    originalUrl,
    customAlias,
    expiryDate,
    createdAt,
    accessNumber,
    qrCodeDataURL,
    shortCode
  }
`;

app.get('/:shortCode', async (req, res) => {
  try {
    const client = await connectToDatabase();
    const { shortCode } = req.params;

    // Fetch the URL data from FaunaDB
    const {data: url} = await client.query(
      fql`let url: Any = Url.byShortCode(${shortCode}).first()${urlResponse}`
    );

    if (!url) {
      return res.status(404).send('Not Found');
    }

    if (url.expiryDate && url.expiryDate < new Date()) {
      return res.status(410).send('Gone'); // Expired
    }

    url.accessNumber++;

    const { data: urlSaved } = await client.query(
      fql`let url: Any = Url.byId(${url.id})!.update({accessNumber: ${url.accessNumber}});
      ${urlResponse}`);

    res.redirect(302, urlSaved.originalUrl); // 302 Redirect
  } catch (error) {
    console.error(error);

    // Check if the error is due to the URL not being found
    if (error.message === 'instance not found') {
      return res.status(404).send('Not Found');
    }

    res.status(500).send('Internal Server Error');
  }
});

exports.handler = serverless(app);