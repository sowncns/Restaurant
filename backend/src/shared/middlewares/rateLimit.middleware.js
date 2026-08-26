// src/shared/middlewares/rateLimit.middleware.js
const rateLimit = require("express-rate-limit");
const env = require("../../config/env");

const whitelistedIps = env.RATE_LIMIT_WHITELIST_IPS.split(",").map((ip) => ip.trim()).filter(Boolean);

// Rate limit bat khi: chay production HOAC bat co RATE_LIMIT_ENABLED (de test o dev).
// IP trong RATE_LIMIT_WHITELIST_IPS luon duoc bo qua (vd may chay Selenium demo).
const skip = (req) => !(env.isProduction || env.RATE_LIMIT_ENABLED) || whitelistedIps.includes(req.ip);

const generalLimiter = rateLimit({ windowMs: 60_000, max: 120, skip });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: env.RATE_LIMIT_AUTH_MAX, skip });

module.exports = { generalLimiter, authLimiter };
