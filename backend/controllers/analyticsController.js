const Analytics = require('../models/Analytics');
const Truck = require('../models/Truck');
const User = require('../models/User');
const { refreshAllAnalytics } = require('../utils/analyticsWorker');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Serves precomputed analytics from the database
 * GET /api/analytics?truckId=...&days=30
 */
exports.getAnalytics = asyncHandler(async (req, res) => {
    let { truckId, days = 30 } = req.query;
    days = parseInt(days);

    // Fetch user for permissions
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Role-based filtering
    if (user.role === 'manager') {
        const managedTrucks = await Truck.find({ manager: user._id }).select('_id');
        const managedIds = managedTrucks.map(t => t._id.toString());

        if (managedIds.length === 0) return res.status(403).json({ success: false, error: 'No trucks assigned' });
        if (!truckId) truckId = managedIds[0];
        else if (!managedIds.includes(truckId)) return res.status(403).json({ success: false, error: 'Access denied' });
    } else if (user.role === 'admin') {
        // Admin can see null/all or specific
    } else if (user.role === 'staff') {
        if (!user.assignedTruck) return res.status(403).json({ success: false, error: 'No truck assigned' });
        truckId = user.assignedTruck.toString();
    }

    // Fetch the precomputed record
    const query = { days };
    if (truckId && truckId !== 'null') query.truck = truckId;
    else query.truck = null;

    const result = await Analytics.findOne(query);
    if (!result) {
        return res.status(404).json({
            success: false,
            error: 'Analytics not ready yet. Please try again later or trigger a refresh.'
        });
    }

    res.json({ success: true, data: result });
});

/**
 * Manually triggers a refresh (Admin only)
 * POST /api/analytics/refresh
 */
exports.triggerRefresh = asyncHandler(async (req, res) => {
    // Fire and forget (or await if you want to wait, but it takes 15-30s)
    refreshAllAnalytics();
    res.json({ success: true, message: 'Analytics refresh started' });
});

exports.getSummary = exports.getAnalytics;
exports.getSalesTrend = exports.getAnalytics;
exports.getTopItems = exports.getAnalytics;
exports.getPeakHours = exports.getAnalytics;
