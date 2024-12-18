const jwt = require("jsonwebtoken");
const express = require('express');
const app = express();
const https = require('https');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const morgan = require('morgan');

// Morgan for request logging
app.use(morgan('combined', { stream: fs.createWriteStream(path.join(__dirname, 'logs/access.log'), { flags: 'a' }) }));

// Middleware for logging errors and unauthorized access
app.use((req, res, next) => {
    logger.info(`Request: ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

const authenticateToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    logger.warn(`Unauthorized access attempt: IP - ${request.ip}, Endpoint - ${request.url}`);
    return response.status(403).json({ message: "No token" });
  }

  jwt.verify(token, "secretKey", (error, user) => {
    if (error) {
      logger.error(`Token verification failed: ${error.message}`);
      return response.status(403).json({ message: "Failure to authenticate token" });
    }

    request.user = user;
    next();
  });
};

module.exports = authenticateToken;