const { spawn } = require('child_process');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Truck = require('../models/Truck');

/**
 * Main analytics endpoint that spawns the Python engine on-demand
 * GET /api/analytics?truckId=...&days=30
 */
exports.getAnalytics = asyncHandler(async (req, res) => {
    let { truckId, days = 30 } = req.query;
    const scriptPath = path.join(__dirname, '../analytics/engine.py');

    // Fetch fresh user data from DB to ensure role is correct
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Role-based filtering logic
    if (user.role === 'manager') {
        // Find all trucks managed by this user
        const managedTrucks = await Truck.find({ manager: user._id }).select('_id');
        const managedIds = managedTrucks.map(t => t._id.toString());

        if (managedIds.length === 0) {
            // Return empty analytics instead of 403 for new managers
            return res.json({
                success: true,
                data: {
                    summary: { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 },
                    charts: {},
                    lastUpdated: new Date().toISOString()
                }
            });
        }

        if (!truckId) {
            // Default to the first managed truck if none specified
            truckId = managedIds[0];
        } else if (!managedIds.includes(truckId)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: You do not manage this truck' });
        }
    } else if (user.role === 'admin') {
        // Admin can see null (all) or any specific truckId
        truckId = truckId || 'null';
    } else if (user.role === 'staff') {
        // If staff, restrict to their assigned truck
        if (!user.assignedTruck) {
            return res.status(403).json({ success: false, error: 'Unauthorized: No truck assigned to you' });
        }
        truckId = user.assignedTruck.toString();
    } else {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Prepare arguments
    const args = [scriptPath, truckId, days];

    const python = spawn('python', args);
    let resultData = '';
    let errorData = '';

    python.stdout.on('data', (data) => {
        resultData += data.toString();
    });

    python.stderr.on('data', (data) => {
        errorData += data.toString();
    });

    python.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Analytics engine failed to start' });
        }
    });

    python.on('close', (code) => {
        if (code !== 0) {
            console.error(`Python error (code ${code}):`, errorData);
            if (!res.headersSent) {
                return res.status(500).json({ success: false, error: 'Analytics engine failed' });
            }
            return;
        }

        try {
            const parsed = JSON.parse(resultData);
            if (!parsed.success) {
                if (!res.headersSent) {
                    return res.status(500).json({ success: false, error: parsed.error });
                }
                return;
            }
            if (!res.headersSent) {
                res.json(parsed);
            }
        } catch (e) {
            console.error('Failed to parse Python output:', resultData);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Malformed analytics data' });
            }
        }
    });
});

exports.getSummary = exports.getAnalytics;
exports.getSalesTrend = exports.getAnalytics;
exports.getTopItems = exports.getAnalytics;
exports.getPeakHours = exports.getAnalytics;
