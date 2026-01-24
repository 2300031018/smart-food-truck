const mongoose = require('mongoose');
const slugify = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

const TruckSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    slug: { type: String, unique: true, index: true },
    description: { type: String, maxlength: 500 },
    cuisineType: { type: String, index: true },
    location: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
      address: { type: String }
    },
    liveLocation: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
      updatedAt: { type: Date }
    },
    schedule: [{ area: String, time: String }],
    operatingHours: [
      {
        day: { type: String },
        open: { type: String },
        close: { type: String }
      }
    ],
    capacity: { type: Number, min: 0 },
    status: { type: String, enum: ['active', 'inactive', 'en_route', 'offline', 'maintenance'], default: 'active', index: true },
    isActive: { type: Boolean, default: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

TruckSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name);
  }
  next();
});

module.exports = mongoose.model('Truck', TruckSchema);
