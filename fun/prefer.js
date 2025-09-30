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
    if (!process.env.MP_WEBHOOK_SECRET) {
      console.warn('MP_WEBHOOK_SECRET not configured, skipping signature validation');
      return true;
    }

    if (!xSignature || !xSignature.includes('ts=') || !xSignature.includes('v1=')) {
      console.error('Invalid x-signature format');
      return false;
    }

    const parts = xSignature.split(',');
    let timestamp, signature;

    for (const part of parts) {
      const [key, value] = part.split('=', 2);
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
      console.error('Missing timestamp or signature in x-signature header');
      return false;
    }

    // Validate timestamp (prevent replay attacks - 5 minutes window)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const webhookTimestamp = parseInt(timestamp);
    const timeDifference = Math.abs(currentTimestamp - webhookTimestamp);

    if (timeDifference > 300) { // 5 minutes
      console.error(`Webhook timestamp too old: ${timeDifference} seconds difference`);
      return false;
    }

    // Create the string to sign: id + request_url + timestamp
    const dataId = payload.data?.id || '';
    const dataToSign = `${dataId}${timestamp}`;

    // Create HMAC with webhook secret
    const expectedSignature = crypto
      .createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
      .update(dataToSign)
      .digest('hex');

    const isValid = signature === expectedSignature;

    if (!isValid) {
      console.error('Signature validation failed');
      console.error('Expected:', expectedSignature);
      console.error('Received:', signature);
      console.error('Data signed:', dataToSign);
    }

    return isValid;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
};

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
            external_reference: sessionId,
            notification_url: `${process.env.BASE_URL}/webhook`
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

            console.log(`Processing payment ${paymentId} with status: ${paymentDetails.status}`);

            // Update payment status in our database (backward compatibility)
            await updatePaymentStatus(
                paymentDetails.id.toString(),
                paymentDetails.status,
                paymentDetails.merchant_order_id
            );

            // Handle approved payments - create premium URL
            if (paymentDetails.status === 'approved') {
                const sessionId = paymentDetails.external_reference;

                if (sessionId) {
                    // Get pending payment data
                    const pendingPayment = await getPendingPaymentBySessionId(sessionId);

                    if (pendingPayment && pendingPayment.status === 'pending') {
                        try {
                            // Update status to processing
                            await updatePendingPaymentStatus(sessionId, 'processing');

                            // Generate short code for URL
                            let shortCode = pendingPayment.customAlias || generateShortCode();

                            // Check if shortCode already exists, generate new one if needed
                            let existingUrl = await getUrlByShortCode(shortCode);
                            while (existingUrl) {
                                shortCode = generateShortCode();
                                existingUrl = await getUrlByShortCode(shortCode);
                            }

                            // Generate QR Code
                            const qrCodeDataURL = await qrcode.toDataURL(`${process.env.BASE_URL}/${shortCode}`);

                            // Create URL object
                            const newUrl = new Url(
                                pendingPayment.originalUrl,
                                pendingPayment.customAlias,
                                pendingPayment.expiryDate,
                                shortCode,
                                qrCodeDataURL
                            );

                            // Create the premium URL
                            await createUrl(newUrl);
                            const shortUrl = `${process.env.BASE_URL}/${shortCode}`;

                            // Update pending payment status to completed
                            await updatePendingPaymentStatus(sessionId, 'completed', shortUrl);

                            console.log(`Premium URL created successfully for payment ${paymentId}: ${shortUrl}`);
                        } catch (urlCreationError) {
                            console.error(`Failed to create URL for payment ${paymentId}:`, urlCreationError);

                            // Update status to failed
                            await updatePendingPaymentStatus(sessionId, 'failed');
                        }
                    } else if (pendingPayment) {
                        console.log(`Pending payment ${sessionId} already processed with status: ${pendingPayment.status}`);
                    } else {
                        console.warn(`No pending payment found for sessionId: ${sessionId}`);
                    }
                } else {
                    console.warn(`Payment ${paymentId} approved but no external_reference (sessionId) found`);
                }
            }

            console.log(`Payment ${paymentId} processing completed`);
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


// Fallback endpoint - only for cases where direct redirect fails
app.get('/urls/check-status/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        await connectToDatabase();

        // Get pending payment data
        const pendingPayment = await getPendingPaymentBySessionId(sessionId);

        if (!pendingPayment) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const response = {
            status: pendingPayment.status,
            sessionId: sessionId
        };

        // If completed, include the URL and QR code data
        if (pendingPayment.status === 'completed' && pendingPayment.shortUrl) {
            response.shortUrl = pendingPayment.shortUrl;
            response.qrCode = await qrcode.toDataURL(pendingPayment.shortUrl);
        }

        res.json(response);
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

exports.handler = serverless(app);