const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema(
    {
        truck: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Truck',
            index: true,
            default: null // null indicates "Overall" analytics
        },
        days: { type: Number, default: 30 },
        summary: {
            totalRevenue: { type: Number, default: 0 },
            orderCount: { type: Number, default: 0 },
            avgOrderValue: { type: Number, default: 0 }
        },
        charts: {
            salesTrend: { type: String }, // Base64 PNG
            topItems: { type: String },   // Base64 PNG
            peakHours: { type: String }   // Base64 PNG
        },
        lastUpdated: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

// Unique index for specific scope (truck + days)
AnalyticsSchema.index({ truck: 1, days: 1 }, { unique: true });

module.exports = mongoose.model('Analytics', AnalyticsSchema);
