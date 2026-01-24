const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: { type: String, required: true, unique: true, lowercase: true, index: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: true },
    role: { type: String, enum: ['admin', 'manager', 'staff', 'customer'], default: 'customer', index: true },
    managedTrucks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Truck' }],
    assignedTruck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck' },
    staffRole: { type: String, enum: ['cook', 'cashier', 'server', 'general'], default: 'general' },
  lastLoginAt: { type: Date },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Methods
UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Hooks
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', UserSchema);
