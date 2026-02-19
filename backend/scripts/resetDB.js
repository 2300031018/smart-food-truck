/* Reset DB and create a fresh admin user */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Truck = require('../models/Truck');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB:', mongoose.connection.name);

    // Wipe everything
    await Promise.all([
        User.deleteMany({}),
        Truck.deleteMany({}),
        MenuItem.deleteMany({}),
        Order.deleteMany({})
    ]);
    console.log('All collections cleared.');

    // Create admin
    const admin = await User.create({
        name: 'PranavAdmin',
        email: 'tummala9246@gmail.com',
        password: 'Tummala9246@',
        role: 'admin'
    });

    console.log('\n✅ Admin created successfully:');
    console.table([{ name: admin.name, email: admin.email, role: admin.role }]);

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });
