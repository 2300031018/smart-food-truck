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
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', required: true, index: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // assigned/claiming staff
    items: { type: [OrderItemSchema], validate: v => v.length > 0 },
    status: { type: String, enum: ['pending', 'accepted', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'], default: 'pending', index: true },
    total: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
  notes: { type: String },
  placedAt: { type: Date, default: Date.now, index: true },
  readyAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String }
  },
  { timestamps: true }
);

OrderSchema.pre('validate', function (next) {
  if (this.isModified('items')) {
    this.items.forEach(i => { i.lineTotal = i.quantity * i.unitPrice; });
    this.total = this.items.reduce((sum, i) => sum + i.lineTotal, 0);
  }
  next();
});

OrderSchema.index({ truck: 1, createdAt: -1 });
OrderSchema.index({ customer: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);
