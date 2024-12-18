const rateLimit = require('express-rate-limit');

// Limit to 100 requests per hour
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 10, // Limit each IP to 10 requests per window
    legacyHeaders: false,//disable the 'X-rateLimit-*' headers
    message: "Too many requests, please try again later.",
});

module.exports = limiter;