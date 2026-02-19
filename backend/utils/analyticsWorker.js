const { spawn } = require('child_process');
const path = require('path');
const cron = require('node-cron');
const Analytics = require('../models/Analytics');
const Truck = require('../models/Truck');

/**
 * Runs the Python engine for a specific truck (or null) and specific days
 */
const runEngine = (truckId, days) => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../analytics/engine.py');
        const python = spawn('python', [scriptPath, truckId || 'null', days]);

        let resultData = '';
        let errorData = '';

        python.stdout.on('data', (data) => { resultData += data.toString(); });
        python.stderr.on('data', (data) => { errorData += data.toString(); });

        python.on('close', (code) => {
            if (code !== 0) return reject(new Error(errorData || `Exit code ${code}`));
            try {
                const parsed = JSON.parse(resultData);
                if (!parsed.success) return reject(new Error(parsed.error));
                resolve(parsed.data);
            } catch (e) {
                reject(new Error('Malformed JSON output from Python'));
            }
        });
    });
};

/**
 * Computes analytics for all logical scopes and caches them
 */
const refreshAllAnalytics = async () => {
    console.info('[WORKER][ANALYTICS] Starting full refresh...');
    const start = Date.now();

    try {
        // 1. Overall analytics (Last 7, 30, 90 days)
        const timeframes = [7, 30, 90];
        for (const days of timeframes) {
            console.debug(`[WORKER][ANALYTICS] Computing overall stats (${days} days)`);
            const data = await runEngine(null, days);
            await Analytics.findOneAndUpdate(
                { truck: null, days },
                { ...data, lastUpdated: new Date() },
                { upsert: true, new: true }
            );
        }

        // 2. Per-truck analytics (Focus on last 30 days for now to save resources)
        const trucks = await Truck.find({ isActive: true }).select('_id');
        for (const truck of trucks) {
            console.debug(`[WORKER][ANALYTICS] Computing stats for truck ${truck._id}`);
            const data = await runEngine(truck._id, 30);
            await Analytics.findOneAndUpdate(
                { truck: truck._id, days: 30 },
                { ...data, lastUpdated: new Date() },
                { upsert: true, new: true }
            );
        }

        const duration = (Date.now() - start) / 1000;
        console.info(`[WORKER][ANALYTICS] Refresh complete in ${duration}s`);
    } catch (err) {
        console.error('[WORKER][ANALYTICS] Failed:', err.message);
    }
};

/**
 * Initialize the cron job
 */
const initAnalyticsJob = () => {
    // Run every 2 hours
    cron.schedule('0 */2 * * *', refreshAllAnalytics);

    // Also run once on startup
    refreshAllAnalytics();
};

module.exports = { initAnalyticsJob, refreshAllAnalytics };
