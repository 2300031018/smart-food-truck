const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getOrderRoom, getTruckRoom, getSupportRoom, listMessages, postMessage } = require('../controllers/chatController');

// Resolve or create a chat room for an order the user has access to
router.get('/order/:orderId/room', auth, getOrderRoom);
router.get('/truck/:truckId/room', auth, getTruckRoom);
router.get('/support/room', auth, getSupportRoom);
// Message operations
router.get('/rooms/:roomId/messages', auth, listMessages);
router.post('/rooms/:roomId/messages', auth, postMessage);

module.exports = router;
