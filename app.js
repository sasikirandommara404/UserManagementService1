import express from 'express';
import cors from 'cors';
import router from './router/router.js';
import cookieParser from 'cookie-parser';
import './config/env.Validation.js';
import helmet from 'helmet';
import client from 'prom-client';
import responseTime from 'response-time';
import { startConsumer } from './messageBroker/consumer.js';

const app = express()
app.use(cookieParser());
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "50mb" }));  
app.use(express.urlencoded({ extended: true })); 
startConsumer()


const register = client.register;
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
    name: 'http_request_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});
const httpRequestDuration = new client.Histogram({
    name: 'http_request_response_time_seconds',
    help: 'Histogram of response time for HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 1.5, 2, 5] // Define your own buckets
});
app.use(responseTime((req, res, time) => {
    let routePath = req.route?.path || req.path;
    routePath = routePath.replace(/\d+/g, ':id'); // Replace numbers with :id to generalize the route
    httpRequestCounter.labels(req.method, routePath, res.statusCode).inc();
    httpRequestDuration.labels(req.method, routePath, res.statusCode).observe(time / 1000);

}));

app.use('/api/auth', router); 

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.send(metrics);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
export default app;



