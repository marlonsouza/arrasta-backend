require('dotenv').config();
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { MercadoPagoConfig, Payment: MPPayment } = require('mercadopago');
const Url = require('../model/url');
const qrcode = require('qrcode');
const { connectToDatabase, getPendingPaymentBySessionId, updatePendingPaymentStatus, createUrl, getUrlByShortCode } = require('../db/firebase');

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

// Handle return status endpoints
// This function handles: /.netlify/functions/prefer/return/success, pending, failure
app.get('/:status', async (req, res) => {
    try {
        const { status } = req.params;

        const { session_id: sessionId, payment_id, merchant_order_id } = req.query;

        if (!sessionId) {
            return res.redirect(`${process.env.MP_RETURN_URL}/@/error?error=missing_session`);
        }

        await connectToDatabase();

        let redirectUrl = `${process.env.MP_RETURN_URL}/@/${status}?session_id=${sessionId}`;

        if (status === 'success' && payment_id) {
            try {
                // Get payment details from MercadoPago API to confirm
                const mpPayment = new MPPayment(mercadoPagoConfig);
                const paymentDetails = await mpPayment.get({ id: payment_id });

                if (paymentDetails.status === 'approved') {
                    // Try to process the premium URL creation immediately
                    const pendingPayment = await getPendingPaymentBySessionId(sessionId);

                    if (pendingPayment && pendingPayment.status === 'pending') {
                        // Update status to processing
                        await updatePendingPaymentStatus(sessionId, 'processing');

                        // Generate short code for URL
                        let shortCode = pendingPayment.customAlias || generateShortCode();

                        // Check if shortCode already exists
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

                        // Redirect with success data
                        redirectUrl = `${process.env.MP_RETURN_URL}/@/success?session_id=${sessionId}&short_url=${encodeURIComponent(shortUrl)}&payment_id=${payment_id}`;

                        console.log(`Premium URL created immediately for payment ${payment_id}: ${shortUrl}`);
                    } else if (pendingPayment && pendingPayment.status === 'completed') {
                        // Already processed, redirect with existing data
                        redirectUrl = `${process.env.MP_RETURN_URL}/@/success?session_id=${sessionId}&short_url=${encodeURIComponent(pendingPayment.shortUrl)}&payment_id=${payment_id}`;
                    }
                }
            } catch (processingError) {
                console.error('Error processing premium URL immediately:', processingError);
                // Still redirect to success, webhook will handle it
                redirectUrl = `${process.env.MP_RETURN_URL}/@/success?session_id=${sessionId}&payment_id=${payment_id}&processing=true`;
            }
        } else if (payment_id) {
            // Add payment_id to other status redirects
            redirectUrl += `&payment_id=${payment_id}`;
        }

        if (merchant_order_id) {
            redirectUrl += `&merchant_order_id=${merchant_order_id}`;
        }

        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Return endpoint error:', error);
        res.redirect(`${process.env.MP_RETURN_URL}/@/error?error=processing_failed`);
    }
});

exports.handler = serverless(app);