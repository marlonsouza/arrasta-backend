# ✨ arrasta.click - Backend ✨

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR_NETLIFY_SITE_ID/deploy-status)](https://app.netlify.com/sites/YOUR_NETLIFY_SITE_NAME/deploys)

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

* **Shorten:** `https://your-site-name.netlify.app/.netlify/functions/shorten`
* **Redirect:** `https://your-site-name.netlify.app/.netlify/functions/redirect`
* **Info:** `https://your-site-name.netlify.app/.netlify/functions/info`

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

---

<details>
  <summary>🌙 Dark Mode</summary>

```css
body {
  background-color: #222;
  color: #eee;
}