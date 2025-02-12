class Payment {
    constructor(idUrl, idPayment, quantity){
        this.idUrl = idUrl;
        this.idPayment = idPayment;
        this.status = null;
        this.idMerchantOrder = null;
        this.quantity = quantity;
    }
}

module.exports = Payment;