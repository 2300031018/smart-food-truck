const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

// All analytics routes require admin or manager
router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/summary', analyticsController.getSummary);
router.get('/sales-trend', analyticsController.getSalesTrend);
router.get('/top-items', analyticsController.getTopItems);
router.get('/peak-hours', analyticsController.getPeakHours);

module.exports = router;
