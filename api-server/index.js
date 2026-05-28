const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const os = require('os');
const session = require('express-session');
const authRouter = require('./routes/auth');
const receiptHeadingRouter = require('./routes/receiptHeading');
const machineTerminalRegistrationRouter = require('./routes/machineTerminalRegistration');
const auditLogsRouter = require('./routes/auditLogs');
const productsRouter = require('./routes/products');
const stockBatchRouter = require('./routes/stockBatch');
const damageReportsRouter = require('./routes/damageReports');
const usersRouter = require('./routes/users');
const salesRouter = require('./routes/sales');
const dashboardXRouter = require('./routes/dashboardX');
const procurementRouter = require('./routes/procurement');
const posRouter = require('./routes/pos');
const localPrintersRouter = require('./routes/localPrinters');
const requireAuth = require('./middleware/requireAuth');
const auditLogger = require('./middleware/auditLogger');
const requestLogger = require('./middleware/requestLogger');
const { getPool, listTables, ensureKnownTable } = require('./db');
const { ensureCheckoutSchema, verifyCheckoutSchema } = require('./db/ensureCartSchema');
const { ensureReceiptHeadingPrintLogoColumns } = require('./db/ensureReceiptHeadingPrintLogo');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';
const logosDirectory = path.resolve(__dirname, 'api', 'logos');
const productImagesDirectory = path.resolve(__dirname, 'api', 'product-images');

if (!fs.existsSync(logosDirectory)) {
  fs.mkdirSync(logosDirectory, { recursive: true });
}

if (!fs.existsSync(productImagesDirectory)) {
  fs.mkdirSync(productImagesDirectory, { recursive: true });
}

function parseBooleanEnv(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function resolveSameSite(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
    return normalized;
  }
  return fallback;
}

const trustProxy = parseBooleanEnv(process.env.TRUST_PROXY, isProduction);
const cookieSecure = parseBooleanEnv(process.env.SESSION_COOKIE_SECURE, isProduction);
const cookieSameSite = resolveSameSite(process.env.SESSION_COOKIE_SAMESITE, isProduction ? 'none' : 'lax');

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use('/api/logos', express.static(logosDirectory));
app.use('/api/product-images', express.static(productImagesDirectory));

if (trustProxy) {
  app.set('trust proxy', 1);
}

app.use(
  session({
    name: 'linda.sid',
    secret: process.env.SESSION_SECRET || 'development-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

app.use(requestLogger);
app.use(auditLogger);

app.use('/api/auth', authRouter);
app.use('/api/receipt-heading', receiptHeadingRouter);
app.use('/api/machine-terminal-registration', machineTerminalRegistrationRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/products', productsRouter);
app.use('/api/stock-batch', stockBatchRouter);
app.use('/api/damage-reports', damageReportsRouter);
app.use('/api/users', usersRouter);
app.use('/api/sales', salesRouter);
app.use('/api/dashboardx', dashboardXRouter);
app.use('/api/procurement', procurementRouter);
app.use('/api/pos', posRouter);
app.use('/api/local', localPrintersRouter);

app.get('/api/health', async (_request, response) => {
  const payload = {
    service: 'Linda LIM POS API',
    serverTime: new Date().toISOString(),
    dbConnected: false,
    database: process.env.DB_NAME || null,
    message: 'API is running. Add database credentials in server/.env to inspect your current MySQL data.',
  };

  try {
    const currentPool = getPool();
    await currentPool.query('SELECT 1');
    const tables = await listTables();
    let checkoutSchema = { ok: false, checks: {} };

    try {
      checkoutSchema = await verifyCheckoutSchema();
    } catch (schemaError) {
      checkoutSchema = { ok: false, error: schemaError.message };
    }

    response.json({
      ...payload,
      dbConnected: true,
      message: 'API and MySQL connection are ready.',
      tableCount: tables.length,
      checkoutSchema,
    });
  } catch (error) {
    response.status(200).json({
      ...payload,
      message: error.message,
      tableCount: 0,
    });
  }
});

app.get('/api/tables', requireAuth, async (_request, response) => {
  try {
    const tables = await listTables();
    response.json({
      database: process.env.DB_NAME,
      tables,
    });
  } catch (error) {
    response.status(500).json({
      error: error.message,
    });
  }
});

app.get('/api/tables/:tableName/rows', requireAuth, async (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit) || 10, 1), 100);
  const { tableName } = request.params;

  try {
    await ensureKnownTable(tableName);
    const [rows] = await getPool().query('SELECT * FROM ?? LIMIT ?', [tableName, limit]);
    response.json({
      table: tableName,
      limit,
      rowCount: rows.length,
      rows,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      error: error.message,
    });
  }
});

function listLanUrls(portValue) {
  const interfaces = os.networkInterfaces();
  const urls = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        urls.push(`http://${entry.address}:${portValue}`);
      }
    }
  }

  return urls;
}

app.listen(port, host, () => {
  const listenHost = host === '0.0.0.0' ? 'all interfaces (0.0.0.0)' : host;
  console.log(`Linda LIM POS API listening on ${listenHost}:${port}`);
  console.log(`Local access: http://localhost:${port}`);
  const lanUrls = listLanUrls(port);
  if (lanUrls.length > 0) {
    console.log('LAN access URLs:');
    lanUrls.forEach((url) => console.log(`- ${url}`));
  }
  void ensureCheckoutSchema()
    .then((result) => {
      if (!result.ok) {
        console.warn('[checkout-schema] Incomplete after bootstrap:', result.checks);
      }
    })
    .catch((error) => {
      console.error('[checkout-schema] Failed to ensure schema:', error.message);
    });

  void ensureReceiptHeadingPrintLogoColumns().catch((error) => {
    console.error('[receipt-heading] Failed to ensure print logo columns:', error.message);
  });
});