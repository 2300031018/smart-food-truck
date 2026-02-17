const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const truckPermission = require('../middleware/truckPermission');
const {
  createTruck,
  getTrucks,
  getTruck,
  updateTruck,
  deactivateTruck,
  reactivateTruck,
  getManagedTrucks,
  assignManager,
  unassignManager,
  getTruckStaff,
  assignStaff,
  unassignStaff,
  applyDefaultRoutePlanDefaults,
  updateRoutePlan,
  updateStatusLocation,
  startRoute,
  advanceRoute,
  stopRoute,
  forceAllServing
} = require('../controllers/truckController');

router.route('/')
  .get(getTrucks)
  .post(auth, authorize('admin', 'manager'), createTruck);

router.get('/managed', auth, authorize('admin','manager'), getManagedTrucks);
router.patch('/route-plan-defaults', auth, authorize('admin'), applyDefaultRoutePlanDefaults);

router.route('/:id')
  .get(getTruck)
  .put(auth, authorize('admin', 'manager'), updateTruck)
  .delete(auth, authorize('admin','manager'), require('../controllers/truckController').deleteTruck);

router.patch('/:id/deactivate', auth, authorize('admin', 'manager'), deactivateTruck);
router.patch('/:id/reactivate', auth, authorize('admin','manager'), reactivateTruck);
router.patch('/:id/assign-manager', auth, authorize('admin'), assignManager);
router.patch('/:id/unassign-manager', auth, authorize('admin'), unassignManager);
router.get('/:id/staff', auth, authorize('admin','manager'), getTruckStaff);
router.post('/:id/staff', auth, authorize('admin','manager'), assignStaff);
router.delete('/:id/staff/:userId', auth, authorize('admin','manager'), unassignStaff);
router.patch('/:id/route-plan', auth, authorize('admin','manager'), updateRoutePlan);
router.patch('/:id/status-location', auth, authorize('admin','manager'), updateStatusLocation);
router.post('/:id/start-route', auth, authorize('admin','manager'), startRoute);
router.post('/:id/advance-route', auth, authorize('admin','manager'), advanceRoute);
router.post('/:id/stop-route', auth, authorize('admin','manager'), stopRoute);
router.patch('/force-serving', auth, authorize('admin'), forceAllServing);

module.exports = router;
