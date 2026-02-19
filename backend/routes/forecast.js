const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { getTruckForecast } = require('../controllers/forecastController');

router.get('/truck/:id', auth, authorize('admin', 'manager'), getTruckForecast);

module.exports = router;
