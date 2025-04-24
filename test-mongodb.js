require('dotenv').config();
const { connectToDatabase, closeConnection } = require('./db/mongodb');

async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    const { urlCollection, paymentCollection } = await connectToDatabase();
    
    // Test a simple operation
    const result = await urlCollection.findOne({});
    console.log('Connection test successful!');
    console.log('Sample document:', result);
    
    await closeConnection();
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testConnection(); 