const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { cleanupOrphans } = require('../controllers/adminController');

// POST /api/admin/cleanup-orphans
router.post('/cleanup-orphans', auth, authorize('admin'), cleanupOrphans);

module.exports = router;
