let mongoose = require('mongoose');

let missedConnectionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: false,
        default: 'anonymous',
        trim: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    coordinates: {
        lat: {
            type: Number,
            required: true
        },
        lng: {
            type: Number,
            required: true
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create index for geospatial queries (useful for future features)
missedConnectionSchema.index({ 'coordinates.lat': 1, 'coordinates.lng': 1 });

module.exports = mongoose.model('MissedConnection', missedConnectionSchema);