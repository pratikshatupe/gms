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
      /* Log the rejection so a misconfigured CORS_ORIGINS shows up in
       * the server log instead of a generic 500. The frontend dev
       * server may pick a different port (5174 if 5173 is taken),
       * which silently breaks every API call until the env is fixed. */
      logger.warn(`CORS: rejected origin "${origin}" — allowed: ${allowedOrigins.join(', ')}`);
      return callback(new Error(`CORS: origin "${origin}" not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(compression());
app.use(mongoSanitize());

/* Apply xss-clean sanitisation to every route EXCEPT the email dispatch
 * endpoint. The frontend POSTs a fully-rendered HTML envelope (built by
 * htmlShell() in src/utils/emailTemplates.js) to /notifications/dispatch;
 * xss-clean would strip every <tag> from `req.body.html`, leaving the
 * recipient with an empty or text-only message and Gmail showing the
 * raw source / nothing useful.
 *
 * The endpoint is otherwise safe because:
 *   - the body is forwarded verbatim to nodemailer (never rendered as
 *     HTML in our own pages), and
 *   - the dispatch controller validates `to`, `subject`, and that `html`
 *     contains real HTML before passing it on. */
app.use((req, res, next) => {
  if (req.path && req.path.includes('/notifications/dispatch')) {
    return next();
  }
  return xss()(req, res, next);
});

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
