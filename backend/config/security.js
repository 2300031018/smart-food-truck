// Allow multiple local dev origins by default; can override with CORS_WHITELIST env.
// Example env: CORS_WHITELIST=http://localhost:3000,http://localhost:5173
const defaultWhitelist = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:2999',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:2999'
];
const whitelistOverride = (process.env.CORS_WHITELIST || defaultWhitelist.join(',')).split(',').map(o => o.trim()).filter(Boolean);
const allowLocalOrigin = origin => typeof origin === 'string' && /https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
const allowedOrigins = whitelistOverride;

module.exports = {
  cors: {
    origin: function (origin, callback) {
      if (!origin || allowLocalOrigin(origin) || allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`[CORS] Blocked origin: ${origin}. Allowed: ${allowedOrigins.join(' | ')}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS']
  },
  rateLimits: {
    auth: { windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false },
    general: { windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false }
  },
  bodyLimit: process.env.BODY_LIMIT || '200kb'
};