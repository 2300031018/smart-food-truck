const { spawn } = require('child_process');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Main analytics endpoint that spawns the Python engine
 * GET /api/analytics?truckId=...&days=30
 */
exports.getAnalytics = asyncHandler(async (req, res) => {
    const { truckId, days = 30 } = req.query;
    const scriptPath = path.join(__dirname, '../analytics/engine.py');

    // Prepare arguments
    const args = [scriptPath, truckId || 'null', days];

    const python = spawn('python', args);
    let resultData = '';
    let errorData = '';

    python.stdout.on('data', (data) => {
        resultData += data.toString();
    });

    python.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    python.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python error (code ${code}):`, errorData);
            return res.status(500).json({ success: false, error: 'Analytics engine failed' });
        }

        try {
            const parsed = JSON.parse(resultData);
            if (!parsed.success) {
                return res.status(500).json({ success: false, error: parsed.error });
            }
            res.json(parsed);
        } catch (e) {
            console.error('Failed to parse Python output:', resultData);
            res.status(500).json({ success: false, error: 'Malformed analytics data' });
        }
    });
});

// Keep legacy placeholders if needed, but they all now point to the same engine if desired
exports.getSummary = exports.getAnalytics;
exports.getSalesTrend = exports.getAnalytics;
exports.getTopItems = exports.getAnalytics;
exports.getPeakHours = exports.getAnalytics;
