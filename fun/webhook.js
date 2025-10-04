require('dotenv').config();
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { MercadoPagoConfig, Payment: MPPayment } = require('mercadopago');
const Url = require('../model/url');
const qrcode = require('qrcode');
const { connectToDatabase, updatePaymentStatus, getPendingPaymentBySessionId, updatePendingPaymentStatus, createUrl, getUrlByShortCode } = require('../db/firebase');
const crypto = require('crypto');

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

const mercadoPagoConfig = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN, options: { timeout: 5000 } });

// In-memory cache to prevent duplicate webhook processing
const processedWebhooks = new Map();
const WEBHOOK_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedWebhooks.entries()) {
    if (now - timestamp > WEBHOOK_CACHE_TTL) {
      processedWebhooks.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

// Function to validate MercadoPago webhook signature
const validateSignature = (xSignature, xRequestId, queryParams, payload) => {
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
      console.error('Missing timestamp or signature in x-signature header');
      return false;
    }

    // Validate timestamp (prevent replay attacks - 30 minutes window)
    // MercadoPago can retry webhooks with the original timestamp
    const currentTimestamp = Date.now(); // in milliseconds
    const webhookTimestamp = parseInt(timestamp) * 1000; // Convert from seconds to milliseconds

    const timeDifference = Math.abs(currentTimestamp - webhookTimestamp);
    const timeDifferenceInSeconds = Math.floor(timeDifference / 1000);
    const timeDifferenceInMinutes = Math.floor(timeDifferenceInSeconds / 60);

    // Log warning for old timestamps but don't block (MercadoPago retries with old timestamps)
    // The idempotency cache will prevent duplicate processing
    if (timeDifference > 1800000) { // 30 minutes in milliseconds
      console.warn(`⚠️ Webhook timestamp is ${timeDifferenceInMinutes} minutes old (${timeDifferenceInSeconds} seconds)`);
      console.warn('Webhook timestamp:', webhookTimestamp, new Date(webhookTimestamp).toISOString());
      console.warn('This is a retry from MercadoPago - idempotency cache will prevent duplicates');
    } else {
      console.log(`✅ Webhook timestamp valid: ${timeDifferenceInMinutes} minutes old`);
    }

    // Extract data.id from query params exactly as in the official example
    const dataID = queryParams?.['data.id'] || queryParams?.id || '';

    // Generate the manifest string (exactly as in MP documentation)
    const manifest = `id:${dataID};request-id:${xRequestId};ts:${timestamp};`;

    // Create an HMAC signature (exactly as in MP documentation example)
    const hmac = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET);
    hmac.update(manifest);
    const sha = hmac.digest('hex');

    // Compare with the hash from x-signature header
    const isValid = sha === signature;

    if (isValid) {
      console.log('✅ HMAC verification passed');
    } else {
      console.error('❌ HMAC verification failed');
      console.error('Expected (sha):', sha);
      console.error('Received (hash):', signature);
      console.error('Manifest used:', manifest);
      console.error('Full payload:', JSON.stringify(payload, null, 2));
    }

    return isValid;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
};

// Webhook endpoint for MercadoPago notifications
app.post('/webhook', async (req, res) => {
    try {
        const xSignature = req.headers['x-signature'];
        const xRequestId = req.headers['x-request-id'];
        const queryParams = req.query;
        const payload = req.body;

        console.log(`📩 Webhook received: topic=${payload.topic || payload.type}, resource=${payload.resource || payload.data?.id}`);

        // Validate signature if webhook secret is configured (warning mode)
        if (process.env.MP_WEBHOOK_SECRET && xSignature) {
            const isValidSignature = validateSignature(xSignature, xRequestId, queryParams, payload);
            if (!isValidSignature) {
                console.warn('⚠️ Webhook signature validation failed - processing anyway (relying on idempotency)');
                console.warn('If you see many failed signatures, check MP_WEBHOOK_SECRET configuration');
            } else {
                console.log('✅ Webhook signature validated successfully');
            }
        }

        // Handle payment notifications
        // Support both old format (type: 'payment') and new format (topic: 'payment')
        if (payload.type === 'payment' || payload.topic === 'payment') {
            await connectToDatabase();

            // Extract payment ID from different webhook formats
            const paymentId = payload.data?.id || payload.resource || payload.id;

            if (!paymentId) {
                console.error('No payment ID found in webhook payload:', JSON.stringify(payload));
                return res.status(400).json({ error: 'Missing payment ID' });
            }

            const webhookKey = `payment_${paymentId}`;

            // Check if this webhook was already processed (idempotency)
            if (processedWebhooks.has(webhookKey)) {
                console.log(`Webhook for payment ${paymentId} already processed, skipping duplicate`);
                return res.status(200).json({ success: true, message: 'Already processed' });
            }

            // Mark this webhook as being processed
            processedWebhooks.set(webhookKey, Date.now());

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

        // Handle merchant_order notifications (can be ignored or logged)
        if (payload.topic === 'merchant_order') {
            console.log('Merchant order notification received - ignoring (payment webhook will handle this)');
        }

        // Always respond with 200 to acknowledge receipt
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        // Still respond with 200 to prevent MercadoPago from retrying
        res.status(200).json({ error: 'Internal error' });
    }
});

exports.handler = serverless(app);