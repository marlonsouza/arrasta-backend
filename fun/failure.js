require('dotenv').config();
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();
app.use(express.json());
app.use(cors());

// Configure Express to trust the proxy
app.set('trust proxy', 1);

// Main failure handler function
const handleFailure = async (req, res) => {
    try {
        const { session_id: sessionId, payment_id, merchant_order_id } = req.query;

        console.log('Failure endpoint called with:', req.query);

        if (!sessionId) {
            return res.redirect(`${process.env.MP_RETURN_URL}/@/error?error=missing_session`);
        }

        let redirectUrl = `${process.env.MP_RETURN_URL}/@/failure?session_id=${sessionId}`;

        if (payment_id) {
            redirectUrl += `&payment_id=${payment_id}`;
        }

        if (merchant_order_id) {
            redirectUrl += `&merchant_order_id=${merchant_order_id}`;
        }

        console.log(`Redirecting to: ${redirectUrl}`);
        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Failure endpoint error:', error);
        res.redirect(`${process.env.MP_RETURN_URL}/@/error?error=processing_failed`);
    }
};

// Also handle /failure path for explicit calls
app.get('/failure', handleFailure);

exports.handler = serverless(app);