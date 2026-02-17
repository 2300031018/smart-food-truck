/* Seed script: creates base users, one truck, and menu items */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Truck = require('../models/Truck');
const MenuItem = require('../models/MenuItem');

async function run() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed in production');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  await Promise.all([
    User.deleteMany({}),
    Truck.deleteMany({}),
    MenuItem.deleteMany({})
  ]);
  console.log('Cleared collections');

  const admin = await User.create({ name: 'Admin User', email: 'admin@example.com', password: 'Password123!', role: 'admin' });
  const manager = await User.create({ name: 'Manager User', email: 'manager@example.com', password: 'Password123!', role: 'manager' });
  const customer = await User.create({ name: 'Customer User', email: 'customer@example.com', password: 'Password123!', role: 'customer' });

  const truck = await Truck.create({
    name: 'Seed Truck One',
    cuisineType: 'Fusion',
    manager: manager._id,
    status: 'OPEN',
    capacity: 4,
    location: { lat: 12.9716, lng: 77.5946 },
    liveLocation: { lat: 12.9716, lng: 77.5946, updatedAt: new Date() }
  });

  const menuItems = await MenuItem.insertMany([
    { truck: truck._id, name: 'Seed Taco', category: 'Main', price: 8.5, prepTime: 5 },
    { truck: truck._id, name: 'Seed Bowl', category: 'Main', price: 11.0, prepTime: 7 },
    { truck: truck._id, name: 'Seed Drink', category: 'Beverage', price: 3.25, prepTime: 1 }
  ]);

  console.log('Seed complete');
  console.table([
    { user: admin.email, role: admin.role },
    { user: manager.email, role: manager.role },
    { user: customer.email, role: customer.role }
  ]);
  console.log('Truck ID:', truck._id.toString());
  console.log('Menu Items:', menuItems.map(m => m.name).join(', '));
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
