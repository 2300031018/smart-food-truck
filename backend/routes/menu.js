const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role'); // use for admin/manager gating
const truckPermission = require('../middleware/truckPermission');
const { addItem, getMenuForTruck, updateItem, deleteItem, toggleAvailability, updateStock } = require('../controllers/menuController');

// /api/menu/truck/:truckIdww
router.route('/truck/:truckId')
  .get(getMenuForTruck)
  // Admin or the manager of the truck can create menu items
  .post(auth, authorize('admin','manager'), truckPermission(), addItem);

router.route('/:id')
  // Admin or truck's manager can update menu items
  .put(auth, authorize('admin','manager'), truckPermission({ fromMenuItem: true }), updateItem);

// Admin or truck's manager can delete a menu item
router.delete('/:id', auth, authorize('admin','manager'), truckPermission({ fromMenuItem: true }), deleteItem);

// Admin or truck's manager can freely toggle availability; staff should use stock endpoint to mark sold out
router.patch('/:id/toggle', auth, authorize('admin','manager'), truckPermission({ fromMenuItem: true }), toggleAvailability);
// Stock updates allowed for staff (on their truck) and also for manager/admin
router.patch('/:id/stock', auth, truckPermission({ fromMenuItem: true }), updateStock);

module.exports = router;
