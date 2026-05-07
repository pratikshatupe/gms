'use strict';

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

const env = require('./config/env');
const logger = require('./config/logger');
const apiRouter = require('./routes');
const errorHandler = require('./middlewares/error.middleware');
const notFound = require('./middlewares/notFound.middleware');
const { apiLimiter } = require('./middlewares/rateLimit.middleware');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigins = env.security.corsOrigins;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS: origin not allowed'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(compression());
app.use(mongoSanitize());
app.use(xss());

app.use(
  morgan(env.isProd ? 'combined' : 'dev', {
    stream: logger.stream,
    skip: (req) => req.path === `${env.apiPrefix}/health`,
  })
);

app.get('/', (_req, res) =>
  res.json({
    name: env.appName,
    version: '1.0.0',
    api: env.apiPrefix,
    status: 'running',
  })
);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(env.apiPrefix, apiLimiter, apiRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
