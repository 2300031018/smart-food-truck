require('dotenv').config({ path: './.env' }); // adjusted path
const mongoose = require('mongoose');
const User = require('./models/User'); // adjusted path
const Truck = require('./models/Truck'); // adjusted path
const Menu = require('./models/Menu'); // adjusted path
const Order = require('./models/Order'); // adjusted path


// India-based truck data
const INDIA_TRUCKS = [
  {
    name: 'Hyderabad Spice Route',
    cuisineType: 'Biryani & Kebabs',
    status: 'SERVING',
    reviews: { average: 4.8, count: 120 },
    image: '/images/truck1.jpg',
    location: {
      lat: 17.4401, lng: 78.3489, address: 'Hitech City, Hyderabad'
    },
    liveLocation: { lat: 17.4401, lng: 78.3489 },
    currentLocation: { lat: 17.4401, lng: 78.3489 },
    routePlan: {
      stops: [
        { name: 'Mindspace', lat: 17.4423, lng: 78.3768, waitTime: 30 },
        { name: 'Gachibowli', lat: 17.4401, lng: 78.3489, waitTime: 45 },
        { name: 'Jubilee Hills', lat: 17.4325, lng: 78.4071, waitTime: 60 }
      ]
    }
  },
  {
    name: 'Bangalore Tech Bites',
    cuisineType: 'South Indian Fusion',
    status: 'SERVING',
    reviews: { average: 4.6, count: 95 },
    image: '/images/truck2.jpg',
    location: {
      lat: 12.9716, lng: 77.5946, address: 'Indiranagar, Bangalore'
    },
    liveLocation: { lat: 12.9716, lng: 77.5946 },
    currentLocation: { lat: 12.9716, lng: 77.5946 },
    routePlan: {
      stops: [
        { name: 'Indiranagar', lat: 12.9716, lng: 77.6412, waitTime: 30 },
        { name: 'Koramangala', lat: 12.9352, lng: 77.6245, waitTime: 45 },
        { name: 'Whitefield', lat: 12.9698, lng: 77.7500, waitTime: 60 }
      ]
    }
  },
  {
    name: 'Mumbai Chowpatty Express',
    cuisineType: 'Street Food',
    status: 'SERVING',
    reviews: { average: 4.9, count: 200 },
    image: '/images/truck3.jpg',
    location: { lat: 19.0760, lng: 72.8777, address: 'Bandra West, Mumbai' },
    liveLocation: { lat: 19.0760, lng: 72.8777 },
    currentLocation: { lat: 19.0760, lng: 72.8777 },
    routePlan: {
      stops: [
        { name: 'Bandra Bandstand', lat: 19.0544, lng: 72.8206, waitTime: 30 },
        { name: 'Juhu Beach', lat: 19.0988, lng: 72.8264, waitTime: 45 }
      ]
    }
  },
  {
    name: 'Delhi Mughlai Wheels',
    cuisineType: 'North Indian',
    status: 'SERVING',
    reviews: { average: 4.7, count: 150 },
    image: '/images/truck4.jpg',
    location: { lat: 28.6139, lng: 77.2090, address: 'Connaught Place, Delhi' },
    liveLocation: { lat: 28.6139, lng: 77.2090 },
    currentLocation: { lat: 28.6139, lng: 77.2090 },
    routePlan: {
      stops: [
        { name: 'CP Inner Circle', lat: 28.6315, lng: 77.2167, waitTime: 30 },
        { name: 'Hauz Khas', lat: 28.5494, lng: 77.2001, waitTime: 45 }
      ]
    }
  },
  {
    name: 'Kolkata Kathi Rolls',
    cuisineType: 'Rolls & Wraps',
    status: 'SERVING',
    reviews: { average: 4.5, count: 80 },
    image: '/images/truck5.jpg',
    location: { lat: 22.5726, lng: 88.3639, address: 'Park Street, Kolkata' },
    liveLocation: { lat: 22.5726, lng: 88.3639 },
    currentLocation: { lat: 22.5726, lng: 88.3639 },
    routePlan: {
      stops: [
        { name: 'Park Street', lat: 22.5551, lng: 88.3516, waitTime: 30 },
        { name: 'Salt Lake', lat: 22.5865, lng: 88.4143, waitTime: 45 }
      ]
    }
  },
  {
    name: 'Chennai Dosa Depot',
    cuisineType: 'South Indian Tiffins',
    status: 'SERVING',
    reviews: { average: 4.8, count: 110 },
    image: '/images/truck6.jpg',
    location: { lat: 13.0827, lng: 80.2707, address: 'Marina Beach, Chennai' },
    liveLocation: { lat: 13.0827, lng: 80.2707 },
    currentLocation: { lat: 13.0827, lng: 80.2707 },
    routePlan: {
      stops: [
        { name: 'Marina Beach', lat: 13.0500, lng: 80.2824, waitTime: 30 },
        { name: 'Besant Nagar', lat: 13.0002, lng: 80.2710, waitTime: 60 },
        { name: 'ECR', lat: 12.9185, lng: 80.2452, waitTime: 45 }
      ]
    }
  }
];

async function seed() {
  try {
    console.log('Connecting to DB via:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB.');

    // 1. Clear old data by dropping collections (clean slate)
    console.log('Dropping old collections...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (collectionNames.includes('trucks')) await mongoose.connection.db.dropCollection('trucks');
    if (collectionNames.includes('users')) await mongoose.connection.db.dropCollection('users');
    if (collectionNames.includes('orders')) await mongoose.connection.db.dropCollection('orders');
    if (collectionNames.includes('menus')) await mongoose.connection.db.dropCollection('menus');
    console.log('Collections dropped.');

    // 2. Insert Trucks
    console.log('Insering trucks...');
    const createdTrucks = [];
    for (const t of INDIA_TRUCKS) {
      // Slug generation helper
      t.slug = t.name.toLowerCase().replace(/ /g, '-');
      const newTruck = new Truck(t);
      await newTruck.save();
      createdTrucks.push(newTruck);
      console.log(`Created truck: ${newTruck.name}`);
    }

    // 3. Create Admin User
    console.log('Creating Admin...');
    const admin = new User({
      name: 'Pranav',
      email: 'tummala9246@gmail.com',
      password: 'Pranav', // Middleware will hash this
      role: 'admin',
      isActive: true
    });
    await admin.save();
    console.log('Admin user created.');

    // 4. Create Managers
    console.log('Creating Managers...');
    for (const truck of createdTrucks) {
      const city = truck.name.split(' ')[0];
      const mgr = new User({
        name: `Manager ${city}`,
        email: `manager.${city.toLowerCase()}@example.com`,
        password: 'password123',
        role: 'manager',
        assignedTruck: truck._id,
        isActive: true
      });
      await mgr.save();
    }
    console.log('Managers created.');

    console.log('ALL DONE.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding:', err);
    process.exit(1);
  }
}

seed();
