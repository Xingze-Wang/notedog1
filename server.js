const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const createError = require('http-errors');

const config = require('./config/config');
const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');
const Recording = require('./src/models/recording');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
mongoose.connect(config.mongoUri)
    .then(() => logger.info('Connected to MongoDB'))
    .catch(err => logger.error('MongoDB connection error:', err));

// Security middleware
app.use(helmet());
app.use(cors());
app.use(rateLimit({
    windowMs: config.rateLimitWindow,
    max: config.rateLimitMax
}));

// Performance middleware
app.use(compression());
app.use(express.json());
app.use(express.raw({ type: 'audio/wav', limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/transcript', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'transcript.html'));
});

// API endpoints
app.get('/api/recordings', async (req, res, next) => {
    try {
        const recordings = await Recording.find().sort({ createdAt: -1 });
        res.json(recordings);
    } catch (err) {
        next(createError(500, err.message));
    }
});

app.post('/api/recordings', async (req, res, next) => {
    try {
        if (!req.body) {
            throw createError(400, 'No audio data provided');
        }

        const recording = new Recording({
            id: Date.now().toString(),
            transcript: '', // Will be updated after processing
            audio: req.body,
            duration: req.query.duration || '0'
        });

        await recording.save();
        
        // Process audio and update transcript (implement your audio processing logic here)
        
        res.status(201).json(recording);
    } catch (err) {
        next(createError(500, err.message));
    }
});

// Error handling
app.use((req, res, next) => {
    next(createError(404, 'Not Found'));
});

app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.env} mode`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received. Closing server...');
    server.close(() => {
        logger.info('Server closed');
        mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed');
            process.exit(0);
        });
    });
});
