const express = require('express');
const router = express.Router();
const { getMenuRecommendations } = require('../controllers/recommendationController');

router.get('/truck/:id', getMenuRecommendations);

module.exports = router;
