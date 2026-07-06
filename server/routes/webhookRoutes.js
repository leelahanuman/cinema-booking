const express = require("express");
const router = express.Router();
const { razorpayWebhook } = require("../controllers/webhookController");
router.post("/", razorpayWebhook);
module.exports = router;