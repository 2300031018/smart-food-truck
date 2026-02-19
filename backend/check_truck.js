const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const Truck = require('./models/Truck');

async function check() {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error('MONGO_URI not found in .env');

        await mongoose.connect(uri);
        console.log('Connected to DB');

        const id = '6996a9f710ccec6b0816f3e6';
        const truck = await Truck.findById(id);

        if (truck) {
            console.log('FOUND:', truck.name, '(Active:', truck.isActive, ')');
        } else {
            console.log('NOT FOUND: Truck with ID', id, 'does not exist.');
            const all = await Truck.find().limit(5).select('name');
            console.log('Current trucks in DB:', all);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
