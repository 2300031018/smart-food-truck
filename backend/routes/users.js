const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/role');
const { bootstrapAdmin, createManager, createStaff, listManagers, getManager, updateManager, deleteManager, reactivateManager, listStaff, updateStaff, deactivateStaff, reactivateStaff, assignStaffToTruck, unassignStaffFromTruck, managerUpdateStaffLimited, managersOverview, managersHierarchy, myTeam, listReclaimableStaff, deleteStaff } = require('../controllers/userController');
const rateLimit = require('express-rate-limit');

// Bootstrap limiter: 5 per hour
const bootstrapLimiter = rateLimit({ windowMs: 60*60*1000, max:5, standardHeaders:true, legacyHeaders:false });

// Bootstrap admin (unauthenticated)
router.post('/bootstrap-admin', bootstrapLimiter, bootstrapAdmin);

// Admin creates managers
router.post('/managers', auth, authorize('admin'), createManager);
// Admin list managers
router.get('/managers', auth, authorize('admin'), listManagers);
// Place specific routes BEFORE the generic '/managers/:id' to prevent accidental matches
router.get('/managers/overview', auth, authorize('admin'), managersOverview);
router.get('/managers/hierarchy', auth, authorize('admin'), managersHierarchy);
router.get('/managers/:id', auth, authorize('admin'), getManager);
router.put('/managers/:id', auth, authorize('admin'), updateManager);
router.delete('/managers/:id', auth, authorize('admin'), deleteManager);
router.patch('/managers/:id/reactivate', auth, authorize('admin'), reactivateManager);
// Manager creates staff
router.post('/staff', auth, authorize('admin','manager'), createStaff);
router.get('/staff', auth, authorize('admin','manager'), listStaff);
router.get('/staff/reclaim', auth, authorize('manager'), listReclaimableStaff);
router.put('/staff/:id', auth, authorize('admin'), updateStaff);
router.patch('/staff/:id/deactivate', auth, authorize('admin'), deactivateStaff);
router.patch('/staff/:id/reactivate', auth, authorize('admin'), reactivateStaff);
router.patch('/staff/:id/assign', auth, authorize('admin'), assignStaffToTruck);
router.patch('/staff/:id/unassign', auth, authorize('admin'), unassignStaffFromTruck);
router.patch('/staff/:id/manager-update', auth, authorize('manager'), managerUpdateStaffLimited);
router.delete('/staff/:id', auth, authorize('admin'), deleteStaff);
router.get('/me/team', auth, authorize('admin','manager','staff'), myTeam);
// /me/status removed in MVP

module.exports = router;