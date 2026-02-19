const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/recommendations/truck/:id
 * Suggests items based on what's currently in the cart or popular pairings.
 */
exports.getMenuRecommendations = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const currentItems = req.query.items ? req.query.items.split(',') : [];

    // 1. Get historical orders for this truck
    const orders = await Order.find({
        truck: id,
        status: { $in: ['COMPLETED', 'ready', 'completed', 'delivered'] }
    }).select('items');

    // 2. Build Association Map
    // coOccurrence[itemA][itemB] = count
    const coOccurrence = {};
    const popularity = {};

    orders.forEach(order => {
        const itemNames = order.items.map(i => i.name);

        itemNames.forEach((name, i) => {
            popularity[name] = (popularity[name] || 0) + 1;

            for (let j = i + 1; j < itemNames.length; j += 1) {
                const other = itemNames[j];

                // Count A with B
                if (!coOccurrence[name]) coOccurrence[name] = {};
                coOccurrence[name][other] = (coOccurrence[name][other] || 0) + 1;

                // Count B with A
                if (!coOccurrence[other]) coOccurrence[other] = {};
                coOccurrence[other][name] = (coOccurrence[other][name] || 0) + 1;
            }
        });
    });

    // 3. Generate Recommendations
    let recommendations = [];

    if (currentItems.length > 0) {
        // Strategy: Recommend items frequently bought with the ones currently selected
        const scores = {};
        currentItems.forEach(item => {
            const associations = coOccurrence[item] || {};
            Object.keys(associations).forEach(other => {
                if (!currentItems.includes(other)) {
                    scores[other] = (scores[other] || 0) + associations[other];
                }
            });
        });

        recommendations = Object.keys(scores)
            .map(name => ({ name, score: scores[name] }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }

    // If no specific associations found (or no current items), fallback to general popularity
    if (recommendations.length < 2) {
        const popularFallbacks = Object.keys(popularity)
            .filter(name => !currentItems.includes(name))
            .map(name => ({ name, score: popularity[name] }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        // Merge and remove duplicates
        const existingNames = recommendations.map(r => r.name);
        popularFallbacks.forEach(p => {
            if (!existingNames.includes(p.name)) recommendations.push(p);
        });
    }

    res.json({
        success: true,
        data: recommendations.slice(0, 3)
    });
});
