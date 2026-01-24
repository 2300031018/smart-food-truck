const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', required: true, index: true },
    date: { type: Date, required: true, index: true }, // normalized to start-of-day UTC
    slotStart: { type: String, required: true }, // HH:mm
    slotEnd: { type: String, required: true },
    partySize: { type: Number, min: 1, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending', index: true },
    notes: { type: String }
  },
  { timestamps: true }
);

ReservationSchema.pre('validate', function (next) {
  if (this.slotStart && this.slotEnd && this.slotStart >= this.slotEnd) {
    return next(new Error('slotEnd must be after slotStart'));
  }
  next();
});

module.exports = mongoose.model('Reservation', ReservationSchema);
