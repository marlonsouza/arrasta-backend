require('dotenv').config();
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { connectToDatabase, getPendingPaymentBySessionId } = require('../db/firebase');

const app = express();
app.use(express.json());
app.use(cors());

// Configure Express to trust the proxy
app.set('trust proxy', 1);

// Main success handler function
const handleSuccess = async (req, res) => {
    try {
        const { session_id: sessionId, payment_id, merchant_order_id, collection_id, collection_status, external_reference } = req.query;

        console.log('Success endpoint called with:', req.query);

        if (!sessionId) {
            return res.redirect(`${process.env.MP_RETURN_URL}/@/error?error=missing_session`);
        }

        await connectToDatabase();

        let redirectUrl = `${process.env.MP_RETURN_URL}/@/success?session_id=${sessionId}`;

        if (payment_id) {
            try {
                // Check if payment was already processed by webhook
                const pendingPayment = await getPendingPaymentBySessionId(sessionId);

                if (pendingPayment && pendingPayment.status === 'completed' && pendingPayment.shortUrl) {
                    // Already processed by webhook, redirect with existing data
                    redirectUrl = `${process.env.MP_RETURN_URL}/@/success?session_id=${sessionId}&short_url=${encodeURIComponent(pendingPayment.shortUrl)}&payment_id=${payment_id}`;
                } else if (pendingPayment && pendingPayment.status === 'pending') {
                    // Payment exists but not processed yet - let webhook handle it
                    redirectUrl = `${process.env.MP_RETURN_URL}/@/success?session_id=${sessionId}&payment_id=${payment_id}&processing=true`;
                } else {
                    // No pending payment found or unexpected status
                    redirectUrl = `${process.env.MP_RETURN_URL}/@/success?session_id=${sessionId}&payment_id=${payment_id}&processing=true`;
                }
            } catch (processingError) {
                console.error('Error checking payment status:', processingError);
                // Redirect to success, webhook will handle it
                redirectUrl = `${process.env.MP_RETURN_URL}/@/success?session_id=${sessionId}&payment_id=${payment_id}&processing=true`;
            }

            // Add payment_id to redirect URL if not already added
            if (!redirectUrl.includes('payment_id=')) {
                redirectUrl += `&payment_id=${payment_id}`;
            }
        }

        if (merchant_order_id && !redirectUrl.includes('merchant_order_id=')) {
            redirectUrl += `&merchant_order_id=${merchant_order_id}`;
        }

        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Success endpoint error:', error);
        res.redirect(`${process.env.MP_RETURN_URL}/@/error?error=processing_failed`);
    }
};

// Also handle /success path for explicit calls
app.get('/success', handleSuccess);

exports.handler = serverless(app);