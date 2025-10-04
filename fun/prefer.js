require('dotenv').config();
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { MercadoPagoConfig, Preference, Payment: MPPayment } = require('mercadopago'); // Import the Mercado Pago SDK
const Payment = require('../model/payment');
const Url = require('../model/url');
const qrcode = require('qrcode');
const { connectToDatabase, createPayment, getPaymentByIdPayment, updatePaymentStatus, createPendingPayment, getPendingPaymentBySessionId, updatePendingPaymentStatus, createUrl, getUrlByShortCode } = require('../db/firebase');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const REASON = 'arrasta.click assinatura mensal'; // Define the reason for the preapproval plan

// Generate unique session ID
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Generate short code for URLs
const generateShortCode = () => {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const app = express();
app.use(express.json());
app.use(cors());

// Configure Express to trust the proxy
app.set('trust proxy', 1);

// Create a limiter that allows 5 requests per 5 minutes (more restrictive)
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many payment requests, please wait a few minutes before trying again.' },
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
  },
  // Skip successful requests from counting (only count errors/retries)
  skipSuccessfulRequests: false
});

// Apply rate limiting to all routes
app.use(limiter);

const mercadoPagoConfig = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN, options: { timeout: 5000 } });

app.post('/prefer', async (req, res) => {
    try {
        const { originalUrl, customAlias, expiryDate, quantity = 1 } = req.body;

        // Validate required fields
        if (!originalUrl) {
            return res.status(400).json({
                error: 'Missing required fields: originalUrl is required'
            });
        }

        // Validate quantity is a positive number
        if (!Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({
                error: 'Quantity must be a positive integer'
            });
        }

        // Validate environment variables
        if (!process.env.TRANSACTION_AMOUNT || !process.env.BASE_URL || !process.env.MP_RETURN_URL) {
            console.error('Missing required environment variables');
            return res.status(500).json({
                error: 'Server configuration error'
            });
        }

        await connectToDatabase();

        // Check if customAlias is already being processed (prevent duplicates)
        if (customAlias) {
            const existingUrl = await getUrlByShortCode(customAlias);
            if (existingUrl) {
                return res.status(409).json({
                    error: 'Custom alias already exists or is being processed'
                });
            }
        }

        // Generate unique session ID
        const sessionId = generateSessionId();

        const body = {
            items: [
                {
                    title: REASON,
                    quantity,
                    currency_id: 'BRL',
                    unit_price: Number(process.env.TRANSACTION_AMOUNT)
                }
            ],
            back_urls: {
                success: `${process.env.BASE_URL}/success?session_id=${sessionId}`,
                pending: `${process.env.BASE_URL}/pending?session_id=${sessionId}`,
                failure: `${process.env.BASE_URL}/failure?session_id=${sessionId}`
            },
            auto_return: 'approved',
            external_reference: sessionId
        };

        const preferente = new Preference(mercadoPagoConfig);
        const response = await preferente.create({ body });

        // Store pending payment data
        const pendingPaymentData = {
            sessionId,
            preferenceId: response.id,
            originalUrl,
            customAlias,
            expiryDate,
            paymentData: {
                quantity,
                amount: Number(process.env.TRANSACTION_AMOUNT)
            }
        };

        await createPendingPayment(pendingPaymentData);

        // Still create the old payment record for backward compatibility
        const payment = new Payment(sessionId, response.id, quantity);
        await createPayment(payment);

        res.status(201).json({
            id: response.id,
            sessionId: sessionId
        });
    } catch (error) {
        console.error('Preference creation error:', error);

        // Handle specific MercadoPago errors
        if (error.status) {
            return res.status(error.status).json({
                error: `MercadoPago API error: ${error.message}`
            });
        }

        // Handle database errors
        if (error.message && error.message.includes('Firebase')) {
            return res.status(500).json({
                error: 'Database error occurred'
            });
        }

        // Generic error handler
        res.status(500).json({
            error: 'Failed to create payment preference'
        });
    }
});

exports.handler = serverless(app);