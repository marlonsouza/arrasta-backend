const mongoose = require('mongoose');
require('dotenv').config();

const urlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  customAlias: { type: String, unique: true },
  expiryDate: { type: Date },
  accessNumber: { type: Number, default: 0 } // Adiciona o campo accessNumber com valor padrão 0
});

const Url = mongoose.models.Url || mongoose.model('Url', urlSchema);

const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { // Get from Netlify env variables
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error; // Important: Re-throw the error to stop execution
  }
};

module.exports = { connectToDatabase, Url };