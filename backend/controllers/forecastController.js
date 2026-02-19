const Order = require('../models/Order');
const Truck = require('../models/Truck');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/forecast/truck/:id
 * Generates sales and demand forecasts for a specific truck.
 */
exports.getTruckForecast = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const truck = await Truck.findById(id);
    if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });

    // 1. Get historical orders for this truck
    const orders = await Order.find({
        truck: id,
        status: { $in: ['COMPLETED', 'ready', 'completed', 'delivered'] }
    }).select('total pickupStopId items placedAt');

    // 2. Aggregate data by stop
    const stopStats = {};
    orders.forEach(order => {
        const stopId = order.pickupStopId || 'unknown';
        if (!stopStats[stopId]) {
            stopStats[stopId] = {
                stopName: 'Unknown Stop',
                totalRevenue: 0,
                orderCount: 0,
                avgOrderValue: 0,
                peakHours: {},
                popularItems: {}
            };
        }

        stopStats[stopId].totalRevenue += order.total;
        stopStats[stopId].orderCount += 1;

        // Track peak hours
        const hour = new Date(order.placedAt).getHours();
        stopStats[stopId].peakHours[hour] = (stopStats[stopId].peakHours[hour] || 0) + 1;

        // Track popular items
        order.items.forEach(item => {
            stopStats[stopId].popularItems[item.name] = (stopStats[stopId].popularItems[item.name] || 0) + item.quantity;
        });
    });

    // Calculate averages and link stop names from routePlan
    const routeStops = truck.routePlan?.stops || [];
    const forecasts = Object.keys(stopStats).map(stopId => {
        const stats = stopStats[stopId];
        stats.avgOrderValue = stats.orderCount > 0 ? stats.totalRevenue / stats.orderCount : 0;

        // Find stop name from truck routePlan
        // Note: stopId in Order is usually the index or name
        const stopInfo = routeStops.find(s => s._id?.toString() === stopId || s.name === stopId);
        if (stopInfo) stats.stopName = stopInfo.name;

        return {
            stopId,
            ...stats
        };
    });

    // 3. Simple "Prediction" Heuristic
    // This could be replaced with a more advanced ML model later.
    const summary = {
        totalHistoricalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
        totalHistoricalOrders: orders.length,
        topStop: forecasts.sort((a, b) => b.totalRevenue - a.totalRevenue)[0] || null,
        recommendations: []
    };

    if (summary.topStop) {
        summary.recommendations.push(`Stop "${summary.topStop.stopName}" is your highest earner. Consider extending your stay there.`);
    }

    // Suggest a stop to improve
    const bottomStop = forecasts.sort((a, b) => a.totalRevenue - b.totalRevenue)[0];
    if (bottomStop && bottomStop.orderCount < 2 && forecasts.length > 2) {
        summary.recommendations.push(`Stop "${bottomStop.stopName}" has low engagement. You might want to move this stop to a different time or location.`);
    }

    res.json({
        success: true,
        data: {
            truckId: id,
            forecasts,
            summary
        }
    });
});
