const { spawn } = require('child_process');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Truck = require('../models/Truck');

/**
 * Main analytics endpoint that spawns the Python engine
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
            return res.status(403).json({ success: false, error: 'Unauthorized: No trucks assigned to manage' });
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
        // Other roles (customer) shouldn't even reach here due to route middleware
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Prepare arguments
    const args = [scriptPath, truckId, days];

    const python = spawn('python', args);
    // ... rest of logic stays same
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
