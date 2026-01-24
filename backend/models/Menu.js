const mongoose = require('mongoose');

const MenuSchema = new mongoose.Schema({
  truckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck' },
  itemName: String,
  category: String,
  price: Number,
  isAvailable: { type: Boolean, default: true },
  prepTime: Number
}, { timestamps: true });
// Removed for MVP (MenuItem covers needs)
module.exports = {};
