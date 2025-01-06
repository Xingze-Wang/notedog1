const config = {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nd1',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    assemblyAiKey: process.env.ASSEMBLY_AI_KEY,
    logLevel: process.env.LOG_LEVEL || 'info',
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100 // requests per window
};

module.exports = config;
