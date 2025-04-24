# ✨ arrasta.click - Backend ✨

[![Netlify Status](https://api.netlify.com/api/v1/badges/arrasta-back/deploy-status)](https://app.netlify.com/sites/arrasta-back/deploys)

👋 Hey there! This repository houses the magical backend 🪄 that powers the arrasta.click URL shortener. It's built with a sprinkle of Node.js, a dash of Express.js, and a whole lot of ❤️.

## 🚀 Features

* **Shorten URLs like a boss:** Create short, memorable links with custom aliases.
* **QR Codes for the win:** Generate QR codes for your shortened URLs for easy sharing.
* **Expiration Dates:** Control how long your links stay alive.
* **Redirect with a snap:** Redirect users to the original URLs with lightning speed.
* **Info at your fingertips:** Get all the juicy details about your shortened URLs.
* **Rate Limiting:** Protect your API from abuse with configurable rate limits.
* **Secure Firebase Integration:** Use Firebase Admin SDK for secure server-side operations.

## 💻 Technology Stack

* **Node.js:** The JavaScript runtime that makes everything tick.
* **Express.js:** The go-to framework for building web applications.
* **Netlify Functions:** Serverless functions for easy deployment and scaling.
* **Firebase/Firestore:** The database that holds all the precious links.
* **Express Rate Limit:** Protect your API from abuse.
* **Mercado Pago:** Handle payments seamlessly.

## 🛠️ Local Development

1. **Clone the repo:** `git clone https://github.com/YOUR_GITHUB_USERNAME/arrasta-backend.git`
2. **Install dependencies:** `npm install`
3. **Create a `.env` file:** Fill it with your secrets (see `.env.example`).
4. **Start the magic:** `netlify dev`
5. **Access the awesomeness:** `http://localhost:8888/.netlify/functions/your_function_name`

## ☁️ Deployment

This project is automatically deployed to Netlify. You can find the live functions here:

* **Shorten:** `https://arrasta.click/shorten`
* **Redirect:** `https://arrasta.click/:shortCode`
* **Info:** `https://arrasta.click/info/:shortCode`

## 📖 API Documentation

* **POST /shorten**
    * **Request body:** `{ originalUrl: string, customAlias?: string, expiryDate?: Date }`
    * **Response:** `{ shortUrl: string, qrCode: string, expiryDate?: Date }`
* **GET /{shortCode}**: Redirects to the original URL.
* **GET /info/{shortCode}**: Retrieves information about a short URL.
* **POST /prefer**: Creates a payment preference for Mercado Pago.

## ❤️ Contributing

We welcome contributions with open arms! 🤗 For major changes, please open an issue first to discuss your ideas.

## 📜 License

[MIT](https://choosealicense.com/licenses/mit/)

## Setup

### Firebase Setup

1. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Add a web app to your Firebase project
3. Copy the Firebase configuration from the Firebase console
4. Create a `.env` file in the root directory with the following variables:

```
# Firebase Configuration
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
FIREBASE_APP_ID=your-app-id

# Firebase Admin SDK Configuration (Option 1: Service Account)
# Download serviceAccountKey.json from Firebase Console and place it in the root directory

# Firebase Admin SDK Configuration (Option 2: Environment Variables)
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_CERT_URL=your-client-cert-url

# Application Configuration
BASE_URL=https://your-app-url.netlify.app
MP_ACCESS_TOKEN=your-mercadopago-access-token
TRANSACTION_AMOUNT=10.00
```

5. Set up Firestore Database in your Firebase project
6. Create two collections: `urls` and `payments`
7. **For Firebase Admin SDK setup:**
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the downloaded JSON file as `serviceAccountKey.json` in your project root
   - **IMPORTANT:** Add this file to your `.gitignore` to keep it secure

### Mercado Pago Setup

1. Create a Mercado Pago account at [https://www.mercadopago.com/](https://www.mercadopago.com/)
2. Get your access token from the Mercado Pago dashboard
3. Add the access token to your `.env` file

## Development

### Local Development

```bash
npm install
npm run dev
```

### Deployment

This project is configured for deployment on Netlify. Simply connect your repository to Netlify and it will automatically deploy your application.

### Environment Variables in Netlify

When deploying to Netlify, make sure to add all the necessary environment variables in the Netlify dashboard:

1. Go to Site settings > Build & deploy > Environment
2. Add each variable from your `.env` file
3. For `FIREBASE_PRIVATE_KEY`, make sure to include the entire key including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` parts

## API Endpoints

- `POST /shorten` - Create a shortened URL
- `GET /info/:shortCode` - Get information about a shortened URL
- `POST /prefer` - Create a payment preference

## Rate Limiting

The API is protected with rate limiting to prevent abuse:

- 10 requests per 15 minutes per IP address
- Custom key generator for serverless environments
- Standard rate limit headers included in responses

## Testing

```bash
# Test Firebase connection
node test-firebase-connection.js

# Test Firebase read operations
node test-firebase-read.js

# Test Firebase Admin SDK (requires serviceAccountKey.json or environment variables)
node test-firebase-admin.js
```

## Troubleshooting

### Firebase Permission Issues

If you encounter "PERMISSION_DENIED" errors:

1. Make sure you've set up the Firebase Admin SDK correctly
2. Check that your service account has the necessary permissions
3. Verify that your environment variables are correctly set in Netlify

### Rate Limiting Issues

If you see rate limiting errors in your Netlify Functions logs:

1. Make sure you've set `app.set('trust proxy', 1)` in your Express app
2. Check that your custom key generator is working correctly
3. Consider adjusting the rate limit parameters if needed