const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createOrder, getOrders, getOrder, updateStatus } = require('../controllers/orderController');

router.route('/')
	.get(auth, getOrders)
	.post(auth, createOrder);

router.route('/:id')
	.get(auth, getOrder);

router.patch('/:id/status', auth, updateStatus);
// delay endpoint removed in MVP

module.exports = router;
