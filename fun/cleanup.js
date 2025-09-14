const express = require('express');
const serverless = require('serverless-http');
const { connectToDatabase, deleteExpiredUrls } = require('../db/firebase');
const cors = require('cors');

const app = express();
app.use(cors());

// Cleanup endpoint that can be called automatically
app.post('/cleanup', async (req, res) => {
  try {
    // Simple authentication check - you can add a secret token here
    const authToken = req.headers.authorization;
    if (authToken !== `Bearer ${process.env.CLEANUP_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await connectToDatabase();
    console.log('Starting cleanup of expired URLs...');
    
    const deletedCount = await deleteExpiredUrls();
    
    res.json({ 
      success: true, 
      message: `Cleanup completed successfully. Deleted ${deletedCount} expired URLs.`,
      deletedCount 
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup expired URLs',
      details: error.message 
    });
  }
});

// GET endpoint for manual testing
app.get('/cleanup', async (req, res) => {
  try {
    await connectToDatabase();
    console.log('Starting manual cleanup of expired URLs...');
    
    const deletedCount = await deleteExpiredUrls();
    
    res.json({ 
      success: true, 
      message: `Manual cleanup completed. Deleted ${deletedCount} expired URLs.`,
      deletedCount 
    });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup expired URLs',
      details: error.message 
    });
  }
});

exports.handler = serverless(app);