require('dotenv').config();
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { MercadoPagoConfig, Preference, Payment: MPPayment } = require('mercadopago'); // Import the Mercado Pago SDK
const Payment = require('../model/payment');
const { connectToDatabase, createPayment, getPaymentByIdPayment, updatePaymentStatus } = require('../db/firebase');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const REASON = 'arrasta.click assinatura mensal'; // Define the reason for the preapproval plan

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

const mercadoPagoConfig = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN, options: { timeout: 5000 } });

// Function to validate MercadoPago webhook signature
const validateSignature = (xSignature, payload) => {
  try {
    const parts = xSignature.split(',');
    let timestamp, signature;

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();
        if (trimmedKey === 'ts') {
          timestamp = trimmedValue;
        } else if (trimmedKey === 'v1') {
          signature = trimmedValue;
        }
      }
    }

    if (!timestamp || !signature) {
      return false;
    }

    // Create the string to sign: id + request_url + timestamp
    const dataToSign = `${payload.data?.id || ''}${timestamp}`;

    // Create HMAC with your webhook secret (you'll need to add this to .env)
    const expectedSignature = crypto
      .createHmac('sha256', process.env.MP_WEBHOOK_SECRET || '')
      .update(dataToSign)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
};

app.post('/prefer', async (req, res) => {
    try {
        const { idUrl, quantity } = req.body;

        // Validate required fields
        if (!idUrl || !quantity) {
            return res.status(400).json({
                error: 'Missing required fields: idUrl and quantity are required'
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
            console.error('TRANSACTION_AMOUNT:', process.env.TRANSACTION_AMOUNT);
            console.error('BASE_URL:', process.env.BASE_URL);
            console.error('MP_RETURN_URL:', process.env.MP_RETURN_URL);
            return res.status(500).json({
                error: 'Server configuration error'
            });
        }

        const body = {
            items: [
                {
                    title: REASON,
                    quantity,
                    currency_id: 'BRL',
                    unit_price: Number(process.env.TRANSACTION_AMOUNT)
                }
            ],
            back_url: {
                success: process.env.MP_RETURN_URL + '/@/success',
                pending: process.env.MP_RETURN_URL + '/@/pending',
                failure: process.env.MP_RETURN_URL + '/@/failure'
            },
            auto_return: 'approved',
        };

        const preferente = new Preference(mercadoPagoConfig);

        const response = await preferente.create({ body });

        await connectToDatabase();

        const payment = new Payment(idUrl, response.id, quantity);

        // Insert the payment into Firebase
        await createPayment(payment);

        res.status(201).json({ id: response.id });
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

// Webhook endpoint for MercadoPago notifications
app.post('/webhook', async (req, res) => {
    try {
        const xSignature = req.headers['x-signature'];
        const payload = req.body;

        // Validate signature if webhook secret is configured
        if (process.env.MP_WEBHOOK_SECRET && xSignature) {
            if (!validateSignature(xSignature, payload)) {
                console.error('Invalid webhook signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        // Handle payment notifications
        if (payload.type === 'payment') {
            await connectToDatabase();

            const paymentId = payload.data.id;

            // Get payment details from MercadoPago API
            const mpPayment = new MPPayment(mercadoPagoConfig);
            const paymentDetails = await mpPayment.get({ id: paymentId });

            // Update payment status in our database
            await updatePaymentStatus(
                paymentDetails.id.toString(),
                paymentDetails.status,
                paymentDetails.merchant_order_id
            );

            console.log(`Payment ${paymentId} status updated to: ${paymentDetails.status}`);
        }

        // Always respond with 200 to acknowledge receipt
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        // Still respond with 200 to prevent MercadoPago from retrying
        res.status(200).json({ error: 'Internal error' });
    }
});

// Payment verification endpoint
app.get('/payment/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;

        await connectToDatabase();

        // Get payment from our database
        const localPayment = await getPaymentByIdPayment(id);
        if (!localPayment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Get current status from MercadoPago API
        const mpPayment = new MPPayment(mercadoPagoConfig);
        const paymentDetails = await mpPayment.get({ id: id });

        // Update local status if different
        if (localPayment.status !== paymentDetails.status) {
            await updatePaymentStatus(
                id,
                paymentDetails.status,
                paymentDetails.merchant_order_id
            );
        }

        res.json({
            id: paymentDetails.id,
            status: paymentDetails.status,
            status_detail: paymentDetails.status_detail,
            transaction_amount: paymentDetails.transaction_amount,
            currency_id: paymentDetails.currency_id,
            date_created: paymentDetails.date_created,
            date_last_updated: paymentDetails.date_last_updated
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});

exports.handler = serverless(app);