const Truck = require('../models/Truck');
const MenuItem = require('../models/MenuItem');

/**
 * Ensure the authenticated user has permission on a truck.
 * Allowed if:
 *  - user.role is admin
 *  - user is the truck.manager
 *  - user is in truck.staff array
 * You can provide truckId directly (req.params.truckId) or an itemId to resolve a MenuItem -> truck.
 */
module.exports = function truckPermission({ fromMenuItem = false, staffOnly = false } = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      if (!staffOnly && req.user.role === 'admin') return next();

      let truckId;
      if (fromMenuItem) {
        const item = await MenuItem.findById(req.params.id).select('truck');
        if (!item) return res.status(404).json({ success: false, error: { message: 'Menu item not found' } });
        truckId = item.truck;
      } else {
        truckId = req.params.truckId || req.body.truck || req.body.truckId;
      }

      if (!truckId) return res.status(400).json({ success: false, error: { message: 'Truck context missing' } });

      const truck = await Truck.findById(truckId).select('manager staff');
      if (!truck) return res.status(404).json({ success: false, error: { message: 'Truck not found' } });

      const userId = req.user.id;
      const isManager = truck.manager && truck.manager.toString() === userId;
      const isStaff = (truck.staff || []).some(s => s.toString() === userId);

      // Hard staff scope: staff must ONLY operate on their single assignedTruck
      if (req.user.role === 'staff') {
        if (!req.user.assignedTruck) {
          return res.status(403).json({ success:false, error:{ message:'Staff has no assigned truck' } });
        }
        if (truckId.toString() !== req.user.assignedTruck) {
          return res.status(403).json({ success:false, error:{ message:'Forbidden: not your assigned truck' } });
        }
        // still ensure staff is actually registered on that truck (defense in depth)
        if (!isStaff) {
          return res.status(403).json({ success:false, error:{ message:'Forbidden: staff not registered on this truck' } });
        }
      } else {
        if (staffOnly) {
          if (!isStaff) return res.status(403).json({ success:false, error:{ message:'Forbidden: staff only action' }});
        } else if (!(isManager || isStaff)) {
          return res.status(403).json({ success: false, error: { message: 'Forbidden: not assigned to this truck' } });
        }
      }
      next();
    } catch (err) {
      console.error('truckPermission error:', err.message);
      return res.status(500).json({ success: false, error: { message: 'Server error' } });
    }
  };
};
