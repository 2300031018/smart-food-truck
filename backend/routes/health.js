const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

router.get('/', (req, res) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  const dbState = states[mongoose.connection.readyState] || 'unknown';
  const statusCode = dbState === 'connected' ? 200 : 503;
  res.status(statusCode).json({
    success: dbState === 'connected',
    data: {
      status: dbState === 'connected' ? 'ok' : 'degraded',
      db: dbState,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
