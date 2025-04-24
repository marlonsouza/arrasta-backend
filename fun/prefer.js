const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { MercadoPagoConfig, Preference } = require('mercadopago'); // Import the Mercado Pago SDK
const Payment = require('../model/payment');
const { connectToDatabase, createPayment } = require('../db/firebase'); 
const rateLimit = require('express-rate-limit');

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

app.post('/prefer', async (req, res) => {
    const { idUrl, quantity } = req.body;
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
            success: process.env.BASE_URL,
            pending: process.env.BASE_URL,
            failure: process.env.BASE_URL
        },
        auto_return: 'approved',
    };

    const preferente = new Preference(mercadoPagoConfig);

    preferente.create({ body })
        .then(async response => {
            await connectToDatabase();

            const payment = new Payment(idUrl, response.id, quantity);

            // Insert the payment into Firebase
            await createPayment(payment);

            res.status(201).json({ id: response.id });
        })
        .catch(error => {
            console.error(error);
            res.status(500).json({ error: 'Failed to create payment preference' });
        });
});

exports.handler = serverless(app);