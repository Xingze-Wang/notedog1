const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    transcript: {
        type: String,
        default: ''
    },
    title: String,
    summary: {
        type: String,
        default: null
    },
    audioUrl: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
recordingSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Recording', recordingSchema);
