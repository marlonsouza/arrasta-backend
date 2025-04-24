require('dotenv').config();
const { connectToDatabase, createUrl, getUrlByShortCode } = require('./db/firebase');

async function testConnection() {
  try {
    console.log('Attempting to connect to Firebase...');
    await connectToDatabase();
    
    // Test creating a URL
    const testUrl = {
      originalUrl: 'https://example.com',
      shortCode: 'test' + Date.now(),
      qrCodeDataURL: 'data:image/png;base64,test',
      accessNumber: 0,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    const createdUrl = await createUrl(testUrl);
    console.log('Firebase connection test successful!');
    console.log('Created URL:', createdUrl);
    
    // Test retrieving the URL
    const retrievedUrl = await getUrlByShortCode(createdUrl.shortCode);
    console.log('Retrieved URL:', retrievedUrl);
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testConnection(); 