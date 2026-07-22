const connectDB = require('../config/db');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Truck = require('../models/Truck');

function pad(n) { return n < 10 ? '0' + n : String(n); }
function formatDate(dt) {
  const d = new Date(dt);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function formatTime12(dt) {
  const d = new Date(dt);
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

async function backfill(batchSize = 200) {
  const total = await Order.countDocuments();
  console.log(`Found ${total} orders to check.`);
  let processed = 0;

  const cursor = Order.find().cursor();
  const updates = [];

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const toUpdate = {};
    // fill customerSnapshot
    if (!doc.customerSnapshot || !doc.customerSnapshot.name) {
      try {
        const user = await User.findById(doc.customer).lean();
        if (user) {
          toUpdate.customerSnapshot = { id: user._id, name: user.name || '', email: user.email || '' };
        }
      } catch (e) {
        console.warn('Failed to lookup user for order', doc._id, e.message);
      }
    }

    // fill truckSnapshot
    if (!doc.truckSnapshot || !doc.truckSnapshot.name) {
      try {
        const truck = await Truck.findById(doc.truck).lean();
        if (truck) {
          toUpdate.truckSnapshot = { id: truck._id, name: truck.name || '' };
        }
      } catch (e) {
        console.warn('Failed to lookup truck for order', doc._id, e.message);
      }
    }

    // fill formatted placedAt
    if (!doc.placedDate || !doc.placedTime12) {
      try {
        const placed = doc.placedAt || doc.createdAt || new Date();
        toUpdate.placedDate = formatDate(placed);
        toUpdate.placedTime12 = formatTime12(placed);
      } catch (e) {
        console.warn('Failed to format date for order', doc._id, e.message);
      }
    }

    if (Object.keys(toUpdate).length > 0) {
      updates.push({ id: doc._id, update: toUpdate });
    }

    if (updates.length >= batchSize) {
      // flush
      const bulk = Order.collection.initializeUnorderedBulkOp();
      updates.forEach(u => bulk.find({ _id: u.id }).updateOne({ $set: u.update }));
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

  // final flush
  if (updates.length > 0) {
    const bulk = Order.collection.initializeUnorderedBulkOp();
    updates.forEach(u => bulk.find({ _id: u.id }).updateOne({ $set: u.update }));
    try {
      const res = await bulk.execute();
      console.log('Applied final batch updates:', res.nModified || res.modifiedCount || '(unknown)');
    } catch (e) {
      console.error('Final bulk update failed', e.message);
    }
  }

  console.log('Backfill complete. Processed:', processed);
}

(async () => {
  try {
    await connectDB();
    await backfill();
  } catch (e) {
    console.error('Backfill failed', e);
  } finally {
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(0);
  }
})();
