const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    transcript: {
        type: String,
        required: true
    },
    title: String,
    summary: String,
    audioUrl: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Recording', recordingSchema);
