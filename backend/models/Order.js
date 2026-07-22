const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true }, // snapshot to keep history if item deleted/renamed
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);


// Keep legacy statuses in enum temporarily for backward compatibility; normalize in controller.
const OrderSchema = new mongoose.Schema(
  {
    // Note: `customer` and `truck` ObjectId refs removed by design.
    // Use `customerSnapshot.id` and `truckSnapshot.id` for internal references if needed.
    customerSnapshot: {
      id: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String },
      email: { type: String }
    },
    truckSnapshot: {
      id: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String }
    },
    // Also provide denormalized top-level name fields for easy DB viewing/UI
    customerName: { type: String },
    truckName: { type: String },
    // Formatted date/time fields for quick inspection (dd-mm-yyyy and 12-hour time)
    placedDate: { type: String }, // e.g. 22-07-2026
    placedTime12: { type: String }, // e.g. 4:03 PM
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // assigned/claiming staff
    items: { type: [OrderItemSchema], validate: v => v.length > 0 },
    status: { type: String, enum: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'pending', 'accepted', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'], default: 'PLACED', index: true },
    total: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    pickupStopId: { type: String },
    notes: { type: String },
    // Note: `placedAt`, `createdAt`, and `updatedAt` intentionally removed per destructive migration request.
    readyAt: { type: Date },
    completedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String }
  },
  {}
);

OrderSchema.pre('validate', function (next) {
  if (this.isModified('items')) {
    this.items.forEach(i => { i.lineTotal = i.quantity * i.unitPrice; });
    this.total = this.items.reduce((sum, i) => sum + i.lineTotal, 0);
  }
  next();
});

OrderSchema.index({ 'truckSnapshot.id': 1, '_id': -1 });
OrderSchema.index({ 'customerSnapshot.id': 1, '_id': -1 });
OrderSchema.index({ status: 1, '_id': -1 });

module.exports = mongoose.model('Order', OrderSchema);
