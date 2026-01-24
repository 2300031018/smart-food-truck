const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createReservation, getReservations, updateStatus, cancelReservation } = require('../controllers/reservationController');

router.route('/')
	.get(auth, getReservations)
	.post(auth, createReservation);

router.patch('/:id/status', auth, updateStatus);
router.patch('/:id/cancel', auth, cancelReservation);

module.exports = router;
