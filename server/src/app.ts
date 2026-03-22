import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { initCloudinary } from './config/cloudinary';
import routes from './routes';
import { errorHandler, notFound } from './middleware/error.middleware';

initCloudinary();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// Auth: stricter limit 30 req/15min per IP
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Link preview: 20 req/min (fetches external URLs)
app.use(
  '/api/link-preview',
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many link preview requests' },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// General API: 100 req/min per IP
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
