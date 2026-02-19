/* Drop orphaned chatrooms and chatmessages collections */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);

    for (const col of ['chatrooms', 'chatmessages']) {
        if (names.includes(col)) {
            await db.collection(col).drop();
            console.log(`✅ Dropped: ${col}`);
        } else {
            console.log(`⚠️  Not found: ${col}`);
        }
    }

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });
