const Reservation = require('../models/Reservation');
const Truck = require('../models/Truck');
const asyncHandler = require('../utils/asyncHandler');

// Normalize date (strip time to midnight UTC)
function normalizeDate(d) {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

async function checkConflict(truckId, date, start, end) {
  return await Reservation.findOne({
    truck: truckId,
    date,
    $or: [
      { slotStart: { $lt: end }, slotEnd: { $gt: start } }
    ],
    status: { $ne: 'cancelled' }
  }).select('_id');
}

// POST /api/reservations
exports.createReservation = asyncHandler(async (req, res) => {
  const { truck: truckId, date, slotStart, slotEnd, partySize, notes } = req.body;
  const { missingFields, respondValidation } = require('../utils/validation');
  const missing = missingFields(req.body, ['truck','date','slotStart','slotEnd','partySize']);
  if (missing.length) return respondValidation(res, { missing });
  const truck = await Truck.findById(truckId).select('_id isActive');
  if (!truck || !truck.isActive) return res.status(400).json({ success: false, error: { message: 'Truck inactive or not found' } });
  const normDate = normalizeDate(date);
  const conflict = await checkConflict(truckId, normDate, slotStart, slotEnd);
  if (conflict) return res.status(409).json({ success: false, error: { message: 'Time slot conflict' } });
  const reservation = await Reservation.create({ customer: req.user.id, truck: truckId, date: normDate, slotStart, slotEnd, partySize, notes });
  res.status(201).json({ success: true, data: reservation });
});

exports.getReservations = asyncHandler(async (req, res) => {
  const filter = {};
  let managerTruckIds = null; 

  if (req.user.role === 'customer') {
    filter.customer = req.user.id;
  } else if (req.user.role === 'staff') {
    if (!req.user.assignedTruck) {
      // Force empty result
      filter.truck = '__none__';
    } else {
      filter.truck = req.user.assignedTruck;
    }
  } else if (req.user.role === 'manager') {
    const trucks = await Truck.find({ manager: req.user.id }).select('_id');
    managerTruckIds = trucks.map(t => t._id.toString());
    filter.truck = { $in: managerTruckIds.length ? managerTruckIds : ['__none__'] };
  } else if (req.user.role === 'admin') {
  }

  if (req.query.truck) {
    const requested = req.query.truck;
    if (req.user.role === 'admin') {
      filter.truck = requested;
    } else if (req.user.role === 'staff') {
      // Only apply if it matches their assignedTruck; otherwise keep existing filter
      if (req.user.assignedTruck && requested === req.user.assignedTruck) {
        filter.truck = requested;
      }
    } else if (req.user.role === 'manager') {
      if (!managerTruckIds) {
        const trucks = await Truck.find({ manager: req.user.id }).select('_id');
        managerTruckIds = trucks.map(t => t._id.toString());
      }
      if (managerTruckIds.includes(requested)) {
        filter.truck = requested;
      }
    }
  }

  if (req.query.date) filter.date = normalizeDate(req.query.date);

  const reservations = await Reservation.find(filter).sort({ date: 1, slotStart: 1 });
  res.json({ success: true, data: reservations });
});
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending','confirmed','cancelled','completed'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, error: { message: 'Invalid status' } });
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return res.status(404).json({ success: false, error: { message: 'Reservation not found' } });

  if (req.user.role === 'customer') {
    if (reservation.customer.toString() !== req.user.id) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    const customerAllowed = ['cancelled'];
    if (!customerAllowed.includes(status)) return res.status(403).json({ success: false, error: { message: 'Customers may only cancel reservations' } });
  } else if (['manager','staff'].includes(req.user.role)) {
    // must belong to their truck(s)
    if (req.user.role === 'staff') {
      if (!req.user.assignedTruck || reservation.truck.toString() !== req.user.assignedTruck) {
        return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
      }
    } else if (req.user.role === 'manager') {
      const truck = await Truck.findOne({ _id: reservation.truck, manager: req.user.id }).select('_id');
      if (!truck) return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
    }
  }
  reservation.status = status;
  await reservation.save();
  res.json({ success: true, data: reservation });
});
exports.cancelReservation = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return res.status(404).json({ success: false, error: { message: 'Reservation not found' } });

  if (['cancelled','completed'].includes(reservation.status)) {
    return res.status(409).json({ success: false, error: { message: `Reservation already ${reservation.status}` } });
  }

  if (req.user.role === 'customer') {
    if (reservation.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }
    if (!['pending','confirmed'].includes(reservation.status)) {
      return res.status(409).json({ success: false, error: { message: 'Cannot cancel at this status' } });
    }
  } else if (['manager','staff'].includes(req.user.role)) {
    if (req.user.role === 'staff') {
      if (!req.user.assignedTruck || reservation.truck.toString() !== req.user.assignedTruck) {
        return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
      }
    } else if (req.user.role === 'manager') {
      const truck = await Truck.findOne({ _id: reservation.truck, manager: req.user.id }).select('_id');
      if (!truck) return res.status(403).json({ success:false, error:{ message:'Forbidden' } });
    }
  } // admin bypass

  reservation.status = 'cancelled';
  await reservation.save();
  res.json({ success: true, data: reservation });
});
