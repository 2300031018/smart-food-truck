const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema(
  {
    truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, index: true },
    price: { type: Number, required: true, min: 0 },
    isAvailable: { type: Boolean, default: true, index: true },
    stockCount: { type: Number, default: 0, min: 0 },
    prepTime: { type: Number, min: 0 }
  },
  { timestamps: true }
);

MenuItemSchema.pre('save', function (next) {
  if (this.isModified('price')) {
    this.price = Math.round(this.price * 100) / 100; // two decimals
  }
  next();
});

MenuItemSchema.index({ truck: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('MenuItem', MenuItemSchema);
