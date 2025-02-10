class Url {
    constructor(originalUrl, customAlias, expiryDate, shortCode, qrCodeDataURL) {
        this.originalUrl = originalUrl;
        this.customAlias = customAlias;
        this.expiryDate = expiryDate;
        this.shortCode = shortCode;
        this.qrCodeDataURL = qrCodeDataURL;
    }
}

module.exports = Url;