const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const { MercadoPagoConfig, Preference } = require('mercadopago'); // Import the Mercado Pago SDK
const Payment = require('../model/payment');
const connectToDatabase = require('../db/mongodb'); 

const REASON = 'arrasta.click assinatura mensal'; // Define the reason for the preapproval plan

const app = express();
app.use(express.json());
app.use(cors());

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
            const { client, paymentCollection } = await connectToDatabase();

            const payment = new Payment(idUrl, response.id, quantity);

            // Insert the payment into MongoDB
            await paymentCollection.insertOne(payment);

            res.status(201).json({ id: response.id });
        })
        .catch(error => {
            console.error(error);
            res.status(500).json({ error: 'Failed to create payment preference' });
        });
});

exports.handler = serverless(app);