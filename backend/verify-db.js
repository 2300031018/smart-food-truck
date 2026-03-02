const mongoose = require('mongoose');

const uri = "mongodb+srv://tummala9246:Tummala9246@smartfoodtruck.eb15s.mongodb.net/smart-food-truck?retryWrites=true&w=majority&appName=SmartFoodTruck";

async function verify() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to DB');

    const trucks = await mongoose.connection.db.collection('trucks').find({}).toArray();
    console.log(`Found ${trucks.length} trucks`);
    
    trucks.forEach(t => {
      console.log(`Truck: ${t.name}`);
      console.log(`  Live Loc: ${JSON.stringify(t.liveLocation)}`);
      // check if routePlan exists
      if(t.routePlan && t.routePlan.stops) {
          console.log(`  Stops: ${t.routePlan.stops.length}`);
          t.routePlan.stops.forEach((s, i) => {
              console.log(`    Stop ${i}: ${s.lat}, ${s.lng}`);
          })
      }
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
