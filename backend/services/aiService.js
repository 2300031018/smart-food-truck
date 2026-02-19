const Order = require('../models/Order');

/**
 * AI Service for Smart Food Truck
 * Handles data analysis and predictive features.
 */
class AIService {
    /**
     * Generates menu recommendations for a specific truck based on order history.
     * Logic: Identifies "Frequently Bought Together" items.
     * @param {string} truckId - The ID of the truck to analyze.
     * @param {number} limit - Max number of recommendations to return.
     */
    async getMenuRecommendations(truckId, limit = 5) {
        // 1. Fetch recent successful orders for this truck
        const orders = await Order.find({
            truck: truckId,
            status: 'COMPLETED'
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .select('items');

        if (!orders || orders.length === 0) return [];

        // 2. Count co-occurrences of pairs of items
        // Using a simple Map-based counting for pairs
        const pairsCount = {};
        const individualCount = {};

        orders.forEach(order => {
            const itemIds = order.items.map(i => i.menuItem.toString());

            // Track individual frequency
            itemIds.forEach(id => {
                individualCount[id] = (individualCount[id] || 0) + 1;
            });

            // Track pairs (only if more than 1 item in order)
            if (itemIds.length > 1) {
                for (let i = 0; i < itemIds.length; i++) {
                    for (let j = i + 1; j < itemIds.length; j++) {
                        const pair = [itemIds[i], itemIds[j]].sort().join(':');
                        pairsCount[pair] = (pairsCount[pair] || 0) + 1;
                    }
                }
            }
        });

        // 3. Convert pairs to a ranked list of suggestions
        // We want to return { itemA: suggest_itemB } based on highest pair count
        const recommendations = Object.entries(pairsCount)
            .map(([pair, count]) => {
                const [idA, idB] = pair.split(':');
                return { idA, idB, score: count };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return recommendations;
    }

    /**
     * Simple Wait Time Predictor (ML-Lite)
     * Predicts prep time based on current queue and historical performance.
     */
    async predictWaitTime(truckId) {
        const activeOrders = await Order.countDocuments({
            truck: truckId,
            status: { $in: ['ACCEPTED', 'PREPARING'] }
        });

        // Basic heuristic: 5 mins base + 3 mins per active order
        // In a real ML scenario, we'd use a regression model here.
        const predictedMinutes = 5 + (activeOrders * 3);

        return {
            activeOrders,
            predictedMinutes,
            confidence: activeOrders > 10 ? 'low' : 'high'
        };
    }
}

module.exports = new AIService();
