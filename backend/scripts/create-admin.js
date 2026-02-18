require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdmin() {
    const name = process.argv[2] || 'Admin User';
    const email = process.argv[3] || 'admin@example.com';
    const password = process.argv[4] || 'Admin@123';

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log(`User with email ${email} already exists.`);
            process.exit(0);
        }

        const admin = new User({
            name,
            email,
            password,
            role: 'admin'
        });

        await admin.save();
        console.log('Admin user created successfully:');
        console.log(`Name: ${name}`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error creating admin:', err.message);
        process.exit(1);
    }
}

createAdmin();
