class Url {
    constructor(originalUrl, customAlias, expiryDate, shortCode, qrCodeDataURL) {
        this.originalUrl = originalUrl;
        this.customAlias = customAlias;
        this.expiryDate = expiryDate;
        this.shortCode = shortCode;
        this.qrCodeDataURL = qrCodeDataURL;
        this.createdAt = new Date();
        this.accessNumber = 0;
    }
}

module.exports = Url;