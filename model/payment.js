class Payment {
    constructor(sessionId, preferenceId, quantity){
        this.sessionId = sessionId;
        this.preferenceId = preferenceId;
        this.status = null;
        this.idMerchantOrder = null;
        this.quantity = quantity;
        this.createdAt = new Date();
    }
}

module.exports = Payment;