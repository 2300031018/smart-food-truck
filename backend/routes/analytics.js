const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');

// All analytics routes require admin or manager
router.use(auth);
router.use(authorize('admin', 'manager'));

router.get('/summary', analyticsController.getSummary);
router.get('/sales-trend', analyticsController.getSalesTrend);
router.get('/top-items', analyticsController.getTopItems);
router.get('/peak-hours', analyticsController.getPeakHours);

module.exports = router;
