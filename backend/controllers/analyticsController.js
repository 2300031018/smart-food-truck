const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');

// Helper to get date range
const getRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return { start, end };
};

/**
 * GET /api/analytics/summary?truckId=...&days=30
 */
exports.getSummary = asyncHandler(async (req, res) => {
    const { truckId, days = 30 } = req.query;
    const { start } = getRange(parseInt(days));

    const match = {
        status: 'COMPLETED',
        placedAt: { $gte: start }
    };
    if (truckId) match.truck = new mongoose.Types.ObjectId(truckId);
    if (req.user.role === 'manager') match.truck = new mongoose.Types.ObjectId(req.user.managedTruckId || truckId);

    const stats = await Order.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$total' },
                orderCount: { $sum: 1 },
                avgOrderValue: { $avg: '$total' }
            }
        }
    ]);

    res.json({
        success: true,
        data: stats[0] || { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 }
    });
});

/**
 * GET /api/analytics/sales-trend?truckId=...&days=30
 */
exports.getSalesTrend = asyncHandler(async (req, res) => {
    const { truckId, days = 30 } = req.query;
    const { start } = getRange(parseInt(days));

    const match = {
        status: 'COMPLETED',
        placedAt: { $gte: start }
    };
    if (truckId) match.truck = new mongoose.Types.ObjectId(truckId);

    const trend = await Order.aggregate([
        { $match: match },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$placedAt" } },
                revenue: { $sum: "$total" },
                orders: { $sum: 1 }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    res.json({ success: true, data: trend });
});

/**
 * GET /api/analytics/top-items?truckId=...&days=30
 */
exports.getTopItems = asyncHandler(async (req, res) => {
    const { truckId, days = 30 } = req.query;
    const { start } = getRange(parseInt(days));

    const match = {
        status: 'COMPLETED',
        placedAt: { $gte: start }
    };
    if (truckId) match.truck = new mongoose.Types.ObjectId(truckId);

    const items = await Order.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
            $group: {
                _id: "$items.name",
                quantity: { $sum: "$items.quantity" },
                revenue: { $sum: "$items.lineTotal" }
            }
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 }
    ]);

    res.json({ success: true, data: items });
});

/**
 * GET /api/analytics/peak-hours?truckId=...&days=30
 */
exports.getPeakHours = asyncHandler(async (req, res) => {
    const { truckId, days = 30 } = req.query;
    const { start } = getRange(parseInt(days));

    const match = {
        status: 'COMPLETED',
        placedAt: { $gte: start }
    };
    if (truckId) match.truck = new mongoose.Types.ObjectId(truckId);

    const hours = await Order.aggregate([
        { $match: match },
        {
            $group: {
                _id: { $hour: "$placedAt" },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    res.json({ success: true, data: hours });
});
