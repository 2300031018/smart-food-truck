const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const Truck = require('./backend/models/Truck');
const Order = require('./backend/models/Order');

async function debug() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart-food-truck';
    console.log('Connecting to:', uri.split('@').pop()); // Hide credentials

    await mongoose.connect(uri);

    const targetId = '6996a9f710ccec6b0816f3e6';

    console.log(`Checking for Truck ID: ${targetId}`);
    const truck = await Truck.findById(targetId);

    if (truck) {
        console.log('SUCCESS: Truck found!');
        console.log(JSON.stringify(truck, null, 2));
    } else {
        console.log('FAILURE: Truck NOT found in DB.');

        // Check if it exists with a different ID format or if there are ANY trucks
        const count = await Truck.countDocuments();
        console.log(`Total trucks in DB: ${count}`);

        const allTrucks = await Truck.find().limit(5).select('name _id');
        console.log('Last 5 trucks added:', allTrucks);

        // Check if any order references this ID
        const sampleOrder = await Order.findOne({ truck: targetId });
        if (sampleOrder) {
            console.log('Wait, an order EXISTS referencing this truck ID!');
            console.log('Order ID:', sampleOrder._id);
        } else {
            console.log('No order found referencing this ID either.');
        }
    }

    await mongoose.disconnect();
}

debug().catch(console.error);
