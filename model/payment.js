class Payment {
    constructor(idUrl, idPayment, quantity){
        this.idUrl = idUrl;
        this.idPayment = idPayment;
        this.status = null;
        this.idMerchantOrder = null;
        this.quantity = quantity;
        this.createdAt = new Date();
    }
}

module.exports = Payment;