# ✨ arrasta.click - Backend ✨

[![Netlify Status](https://api.netlify.com/api/v1/badges/arrasta-back/deploy-status)](https://app.netlify.com/sites/arrasta-back/deploys)

👋 Hey there! This repository houses the magical backend 🪄 that powers the arrasta.click URL shortener. It's built with a sprinkle of Node.js, a dash of Express.js, and a whole lot of ❤️.

## 🚀 Features

* **Shorten URLs like a boss:** Create short, memorable links with custom aliases.
* **QR Codes for the win:** Generate QR codes for your shortened URLs for easy sharing.
* **Expiration Dates:** Control how long your links stay alive.
* **Redirect with a snap:** Redirect users to the original URLs with lightning speed.
* **Info at your fingertips:** Get all the juicy details about your shortened URLs.

## 💻 Technology Stack

* **Node.js:** The JavaScript runtime that makes everything tick.
* **Express.js:** The go-to framework for building web applications.
* **Netlify Functions:** Serverless functions for easy deployment and scaling.
* **MongoDB:** The database that holds all the precious links.

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

# Application Configuration
BASE_URL=https://your-app-url.netlify.app
MP_ACCESS_TOKEN=your-mercadopago-access-token
TRANSACTION_AMOUNT=10.00
```

5. Set up Firestore Database in your Firebase project
6. Create two collections: `urls` and `payments`

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

## API Endpoints

- `POST /shorten` - Create a shortened URL
- `GET /info/:shortCode` - Get information about a shortened URL
- `POST /prefer` - Create a payment preference

## Testing

```bash
node test-firebase.js
```