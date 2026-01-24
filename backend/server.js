const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initCache } = require('./utils/cache');

dotenv.config({ path: path.join(__dirname, '.env') });

if (!process.env.MONGO_URI) {
	console.warn('MONGO_URI not set. Will attempt local fallback (mongodb://127.0.0.1:27017/smart-food-truck).');
}

connectDB();
initCache();

const security = require('./config/security');
const app = express();
app.disable('x-powered-by');
app.use(helmet({
	crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors(security.cors));
app.use(express.json({ limit: security.bodyLimit }));

// Global rate limit (broad)
app.use(rateLimit(security.rateLimits.general));
// More strict on auth endpoints
app.use('/api/auth', rateLimit(security.rateLimits.auth));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/trucks', require('./routes/trucks'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/users', require('./routes/users'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/health', require('./routes/health'));

// Not found handler
const notFound = require('./middleware/notFound');
app.use(notFound);

// Error handler (must be last)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Create HTTP server and attach websockets
const server = http.createServer(app);
const { initSocket } = require('./socket');
initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
