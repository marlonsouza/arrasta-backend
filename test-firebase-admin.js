require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
let serviceAccount;
try {
  // Try to load the service account key from a file
  serviceAccount = require('./serviceAccountKey.json');
  console.log('Using service account key file');
} catch (error) {
  // If the file doesn't exist, use environment variables
  console.log('Using environment variables for service account');
  serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  };
}

// Check if we have all the required fields
if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
  console.error('Missing required service account fields. Please check your configuration.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const urlsCollection = db.collection('urls');

async function testConnection() {
  try {
    console.log('Attempting to connect to Firebase Admin...');
    
    // Test creating a URL
    const testUrl = {
      originalUrl: 'https://example.com',
      shortCode: 'test' + Date.now(),
      qrCodeDataURL: 'data:image/png;base64,test',
      accessNumber: 0,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      userId: 'test-user',
      createdAt: new Date().toISOString()
    };
    
    const docRef = await urlsCollection.add(testUrl);
    console.log('Firebase Admin connection test successful!');
    console.log('Created URL with ID:', docRef.id);
    
    // Test retrieving the URL
    const doc = await docRef.get();
    console.log('Retrieved URL:', doc.data());
    
    // Clean up - delete the test document
    await docRef.delete();
    console.log('Test document deleted');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testConnection(); 