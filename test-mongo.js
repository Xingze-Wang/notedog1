require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
    try {
        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Successfully connected to MongoDB!');
        
        // Test the Recording model
        const Recording = require('./src/models/recording');
        const count = await Recording.countDocuments();
        console.log(`Number of recordings in database: ${count}`);
        
    } catch (error) {
        console.error('MongoDB connection error:', error);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

testConnection();
