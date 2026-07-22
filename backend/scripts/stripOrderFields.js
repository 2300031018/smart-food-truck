const connectDB = require('../config/db');
const mongoose = require('mongoose');
const Order = require('../models/Order');

// Usage: node scripts/stripOrderFields.js <mongoUri>
const suppliedUri = process.argv[2];
if (suppliedUri) process.env.MONGO_URI = suppliedUri;

async function strip(batchSize = 200) {
  const total = await Order.countDocuments();
  console.log(`Found ${total} orders to process (destructive).`);
  let processed = 0;
  const cursor = Order.find().cursor();
  const updates = [];

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const toSet = {};
    const toUnset = {};

    if ((!doc.customerName || !doc.customerName.length) && doc.customerSnapshot && doc.customerSnapshot.name) {
      toSet.customerName = doc.customerSnapshot.name;
    }
    if ((!doc.truckName || !doc.truckName.length) && doc.truckSnapshot && doc.truckSnapshot.name) {
      toSet.truckName = doc.truckSnapshot.name;
    }

    // Always unset the specified fields if present
    ['customer','truck','placedAt','createdAt','updatedAt'].forEach(f => { toUnset[f] = ""; });

    if (Object.keys(toSet).length > 0 || Object.keys(toUnset).length > 0) {
      const update = {};
      if (Object.keys(toSet).length > 0) update['$set'] = toSet;
      if (Object.keys(toUnset).length > 0) update['$unset'] = toUnset;
      updates.push({ id: doc._id, update });
    }

    if (updates.length >= batchSize) {
      const bulk = Order.collection.initializeUnorderedBulkOp();
      updates.forEach(u => bulk.find({ _id: u.id }).updateOne(u.update));
      try {
        const res = await bulk.execute();
        console.log('Applied batch updates:', res.nModified || res.modifiedCount || '(unknown)');
      } catch (e) {
        console.error('Bulk update failed', e.message);
      }
      updates.length = 0;
    }

    processed++;
    if (processed % 100 === 0) process.stdout.write(`Processed ${processed}/${total} orders\r`);
  }

  if (updates.length > 0) {
    const bulk = Order.collection.initializeUnorderedBulkOp();
    updates.forEach(u => bulk.find({ _id: u.id }).updateOne(u.update));
    try {
      const res = await bulk.execute();
      console.log('Applied final batch updates:', res.nModified || res.modifiedCount || '(unknown)');
    } catch (e) {
      console.error('Final bulk update failed', e.message);
    }
  }
  console.log('Strip complete. Processed:', processed);
}

(async () => {
  try {
    await connectDB();
    await strip();
  } catch (e) {
    console.error('Strip failed', e);
  } finally {
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(0);
  }
})();
