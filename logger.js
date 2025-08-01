const winston = require('winston');
const expressWinston = require('express-winston');
const date = new Date().toLocaleDateString("en-GB").split('/')
const dateLog = `${date[0]}${date[1]}${date[2]}`
// Create a custom Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: `logs/${dateLog}/app.log` }),
  ],
});

// Middleware to log request and response details, including remote IP
const requestLogger = expressWinston.logger({
  transports: [
    // new winston.transports.Console(),
    new winston.transports.File({ filename: `logs/${dateLog}/request.log` }),
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  meta: true, // Include all metadata fields
  msg: 'HTTP {{req.method}} {{req.url}}', // Log request method and URL
  expressFormat: true, // Use Express.js's default log format
  colorize: false, // Disable colorization of console output
  dynamicMeta: (req, res) => {
    const httpRequest = {};
    const meta = {};
    if (req) {
      meta.httpRequest = httpRequest;
      
      meta.requestBody = req.body;
      httpRequest.requestMethod = req.method;
      httpRequest.requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      httpRequest.protocol = `HTTP/${req.httpVersion}`;
      httpRequest.remoteIp = req.ip; // Include remote IP address
      httpRequest.requestSize = req.socket.bytesRead;
      httpRequest.userAgent = req.get('User-Agent');
      httpRequest.referrer = req.get('Referrer');
    }
    if (res) {
      meta.responseBody = res.body;
    }
    return meta;
  },
});

module.exports = { logger, requestLogger };
