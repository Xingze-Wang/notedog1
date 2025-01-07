const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const createError = require('http-errors');
const { OpenAI } = require('openai');
const fs = require('fs');
const fsPromises = require('fs').promises;
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const logger = require('./src/utils/logger');  // Make sure this exists

// Load environment variables early
dotenv.config();

// Load models
const Recording = require('./src/models/recording');

// Configuration
const config = {
    maxRecordingDuration: 300, // 5 minutes
    maxFileSize: '50mb',
    supportedFormats: ['audio/wav'],
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    apiEndpoints: {
        recordings: '/recordings',
        transcription: '/transcription',
        summary: '/summary'
    }
};

// Validate critical environment variables
const requiredEnvVars = ['MONGODB_URI', 'OPENAI_API_KEY'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        logger.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

const app = express();

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Test OpenAI connectivity
async function testOpenAIConnection() {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "Test connection" }],
            max_tokens: 5
        });
        if (response.choices && response.choices.length > 0) {
            logger.info('OpenAI connection test successful');
            return true;
        }
        throw new Error('Invalid response format');
    } catch (error) {
        logger.error('OpenAI connection test failed:', error);
        return false;
    }
}

// MongoDB connection with proper error handling and retry logic
async function connectDB(retries = 5, delay = 5000) {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ndweb';
    
    for (let i = 0; i < retries; i++) {
        try {
            logger.info(`Attempting to connect to MongoDB (attempt ${i + 1}/${retries})...`);
            await mongoose.connect(mongoURI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            logger.info('Successfully connected to MongoDB');
            return;
        } catch (err) {
            logger.error(`Failed to connect to MongoDB (attempt ${i + 1}/${retries}):`, err);
            if (i < retries - 1) {
                logger.info(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error(`Failed to connect to MongoDB after ${retries} attempts`);
}

// Security middleware with correct configuration for media files
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "https://localhost:3000", "https://api.openai.com"],
            scriptSrcAttr: ["'unsafe-inline'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration with proper options
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
};

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting for summary generation
const summaryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 requests per minute
    message: { error: 'Too many summary requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Basic middleware
app.use(express.json({ limit: config.maxFileSize }));
app.use(express.urlencoded({ extended: true, limit: config.maxFileSize }));
app.use(compression());
app.use(morgan('dev'));
app.use(cors());

// Serve static files
const staticOptions = {
    setHeaders: function(res, path) {
        if (path.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
        }
    }
};

app.use(express.static(path.join(__dirname, 'public'), staticOptions));
app.use('/uploads', express.static('uploads', staticOptions));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Main routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/transcript', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'transcript.html'));
});

// API Routes
app.get('/config', (req, res) => {
    res.json(config);
});

app.get('/recordings', (req, res) => {
    Recording.find({})
        .sort({ timestamp: -1 })
        .then(recordings => res.json(recordings))
        .catch(err => next(createError(500, 'Failed to load recordings')));
});

// Test endpoint for OpenAI connection
app.get('/test/joke', async (req, res, next) => {
    logger.info('=== Starting /test/joke endpoint ===');
    try {
        logger.info('1. Creating OpenAI chat completion request');
        logger.info('OpenAI Config:', {
            apiKey: process.env.OPENAI_API_KEY ? 'Present' : 'Missing',
            model: "gpt-3.5-turbo"
        });
        
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { 
                    role: "system", 
                    content: "You are a helpful assistant that tells jokes." 
                },
                { 
                    role: "user", 
                    content: "Tell me a short, funny joke." 
                }
            ],
            max_tokens: 100,
            temperature: 0.7
        });

        logger.info('2. OpenAI API Response received:', {
            hasChoices: !!completion?.choices,
            choicesLength: completion?.choices?.length,
            hasFirstChoice: !!completion?.choices?.[0],
            hasMessage: !!completion?.choices?.[0]?.message,
            hasContent: !!completion?.choices?.[0]?.message?.content
        });

        if (!completion?.choices?.[0]?.message?.content) {
            logger.error('3. Invalid API response structure:', completion);
            throw new Error('Invalid API response structure');
        }

        const joke = completion.choices[0].message.content;
        logger.info('4. Successfully extracted joke:', { joke });
        
        logger.info('5. Sending response');
        res.json({ joke });
        logger.info('6. Response sent successfully');
        
    } catch (err) {
        logger.error('Error in /test/joke:', {
            error: err.message,
            type: err.type,
            code: err.code,
            stack: err.stack,
            name: err.name
        });
        next(createError(500, 'Failed to connect to AI service: ' + err.message));
    }
});

// API endpoints with proper error handling
app.get('/recordings', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const recordings = await Recording.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select('-__v');
            
        const total = await Recording.countDocuments();
        
        res.json({
            recordings,
            pagination: {
                current: page,
                total: Math.ceil(total / limit),
                count: recordings.length
            }
        });
    } catch (err) {
        logger.error('Error fetching recordings:', err);
        next(createError(500, 'Failed to fetch recordings'));
    }
});

app.post('/recordings', express.json({limit: '50mb'}), async (req, res, next) => {
    try {
        if (!req.body || !req.body.audio) {
            throw createError(400, 'No audio data provided');
        }

        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Generate unique ID and filename
        const id = uuidv4();
        const filename = `recording_${id}.wav`;
        const audioPath = path.join(uploadsDir, filename);

        // Save audio file
        const audioData = req.body.audio.split(',')[1]; // Remove data URL prefix
        fs.writeFileSync(audioPath, Buffer.from(audioData, 'base64'));

        // Create recording document
        const recording = new Recording({
            id: id,
            title: req.body.title || 'New Recording',
            transcript: req.body.transcript || '',
            summary: '',
            audioUrl: path.join('uploads', filename),
            timestamp: new Date(),
            duration: req.body.duration || 0
        });

        await recording.save();
        logger.info(`Recording saved successfully: ${id}`);
        res.status(201).json(recording);
    } catch (err) {
        logger.error('Error saving recording:', err);
        next(createError(500, 'Failed to save recording: ' + err.message));
    }
});

app.get('/recordings/:id', async (req, res, next) => {
    try {
        const recording = await Recording.findOne({ id: req.params.id });
        if (!recording) {
            throw createError(404, 'Recording not found');
        }
        res.json(recording);
    } catch (err) {
        next(err);
    }
});

app.put('/recordings/:id', async (req, res, next) => {
    try {
        const recording = await Recording.findOne({ id: req.params.id });
        if (!recording) {
            throw createError(404, 'Recording not found');
        }

        if (req.body.transcript) {
            recording.transcript = req.body.transcript;
            await recording.save();
            logger.info(`Transcript updated for recording ${recording.id}`);
        }

        res.json(recording);
    } catch (err) {
        logger.error('Error updating recording:', err);
        next(createError(500, 'Failed to update recording'));
    }
});

app.delete('/recordings/:id', async (req, res, next) => {
    try {
        const recording = await Recording.findOne({ id: req.params.id });
        if (!recording) {
            throw createError(404, 'Recording not found');
        }

        // Delete audio file
        const audioPath = path.join(__dirname, recording.audioUrl);
        await fsPromises.unlink(audioPath).catch(err => {
            logger.warn(`Failed to delete audio file for recording ${recording.id}:`, err);
        });

        await recording.deleteOne();
        logger.info(`Recording deleted: ${recording.id}`);
        
        res.status(204).end();
    } catch (err) {
        next(err);
    }
});

app.get('/recordings/:id/summary', summaryLimiter, async (req, res, next) => {
    try {
        logger.info(`Generating summary for recording ${req.params.id}`);
        
        const recording = await Recording.findOne({ id: req.params.id });
        if (!recording) {
            logger.error(`Recording not found: ${req.params.id}`);
            throw createError(404, 'Recording not found');
        }

        // If summary exists and no regenerate flag, return it
        if (recording.summary && !req.query.regenerate) {
            logger.info(`Returning existing summary for ${req.params.id}`);
            return res.json({ content: recording.summary });
        }

        // Check if transcript is available
        if (!recording.transcript) {
            logger.info(`No transcript available yet for ${req.params.id}`);
            return res.json({ content: "The transcript is not ready yet. Please wait a few moments and try again." });
        }

        // Always send to GPT, with transcript if available
        const transcript = String(recording.transcript).trim();
        const maxChars = 4000;
        const truncatedTranscript = transcript.length > maxChars ? 
            transcript.slice(0, maxChars) + '...' : 
            transcript;

        logger.info(`Sending to OpenAI for recording ${req.params.id}`);
        
        let attempts = 0;
        const maxAttempts = 3;
        let lastError;

        while (attempts < maxAttempts) {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { 
                            role: "system", 
                            content: `You are a professional transcription summarizer. Your task is to create a clear, structured summary of spoken content.

For available transcripts, organize your summary into these sections:
1. Main Topic: A one-line description of what the conversation is about
2. Key Points: Bullet points of the main ideas discussed
3. Important Details: Notable specifics or examples mentioned
4. Action Items: Any tasks, follow-ups, or next steps discussed
5. Questions & Concerns: Important questions raised or issues to be resolved

Use clear, concise language and maintain the original context and meaning.` 
                        },
                        { 
                            role: "user", 
                            content: `Summarize this transcript:\n${truncatedTranscript}` 
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.3,
                    presence_penalty: 0.0,
                    frequency_penalty: 0.0,
                });

                const summary = completion.choices[0].message.content;
                recording.summary = summary;
                await recording.save();

                logger.info(`Successfully saved summary for recording ${req.params.id}`);
                return res.json({ content: summary });
            } catch (err) {
                lastError = err;
                logger.error(`OpenAI error attempt ${attempts + 1}:`, err);
                attempts++;
                if (attempts < maxAttempts) {
                    logger.warn(`Retrying in ${attempts} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                }
            }
        }

        // If we get here, all attempts failed
        logger.error('All OpenAI attempts failed:', lastError);
        throw createError(500, 'Failed to generate summary after multiple attempts');
    } catch (err) {
        logger.error('Summary generation error:', err);
        next(err);
    }
});

app.get('/recordings/:id/audio', async (req, res, next) => {
    try {
        const recording = await Recording.findOne({ id: req.params.id });
        if (!recording) {
            throw createError(404, 'Recording not found');
        }

        const audioPath = path.join(__dirname, recording.audioUrl);
        if (!fs.existsSync(audioPath)) {
            throw createError(404, 'Audio file not found');
        }

        // Get file stats
        const stat = fs.statSync(audioPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            // Handle range request
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(audioPath, { start, end });

            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'audio/wav'
            };

            res.writeHead(206, head);
            file.pipe(res);
        } else {
            // Handle normal request
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'audio/wav',
                'Accept-Ranges': 'bytes'
            };

            res.writeHead(200, head);
            fs.createReadStream(audioPath).pipe(res);
        }
    } catch (err) {
        logger.error('Error serving audio file:', err);
        next(err);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

// 404 handler for all routes
app.use((req, res) => {
    if (req.path.startsWith('/recordings') || req.path === '/config') {
        res.status(404).json({ error: 'Not Found' });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await connectDB();
        logger.info('MongoDB connected successfully');

        // Test OpenAI connection
        const openAIConnected = await testOpenAIConnection();
        if (!openAIConnected) {
            throw new Error('Failed to connect to OpenAI');
        }

        // Create required directories
        const dirs = ['uploads', 'logs'];
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        let server;
        
        // In production (Railway), use regular HTTP as SSL is handled by the platform
        if (process.env.RAILWAY_STATIC_URL || process.env.NODE_ENV === 'production') {
            server = app.listen(config.port, '0.0.0.0', () => {
                logger.info(`Server running in production mode on port ${config.port}`);
            });
        } else {
            // In development, use HTTPS
            if (!fs.existsSync('certs')) {
                fs.mkdirSync('certs', { recursive: true });
            }
            
            const privateKey = fs.readFileSync(process.env.SSL_KEY_PATH || 'certs/server.key', 'utf8');
            const certificate = fs.readFileSync(process.env.SSL_CERT_PATH || 'certs/server.crt', 'utf8');
            const credentials = { key: privateKey, cert: certificate };

            server = https.createServer(credentials, app);
            server.listen(config.port, () => {
                logger.info(`Server running in development mode on port ${config.port}`);
            });
        }

        // Graceful shutdown
        process.on('SIGTERM', () => shutdown('SIGTERM', server));
        process.on('SIGINT', () => shutdown('SIGINT', server));
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown handling
async function shutdown(signal, server) {
    logger.info(`${signal} signal received. Starting graceful shutdown...`);
    
    server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
            await mongoose.connection.close(false);
            logger.info('MongoDB connection closed');
            
            // Cleanup temporary files if needed
            logger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (err) {
            logger.error('Error during shutdown:', err);
            process.exit(1);
        }
    });

    // Force shutdown after timeout
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

// Unhandled rejection handling
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handling
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
});
