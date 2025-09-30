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

    // MercadoPago webhook timestamp is always in milliseconds, convert to seconds
    const adjustedWebhookTimestamp = Math.floor(webhookTimestamp / 1000);

    const timeDifference = Math.abs(currentTimestamp - adjustedWebhookTimestamp);

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

exports.handler = serverless(app);