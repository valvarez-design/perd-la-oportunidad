//load env variables
require('dotenv').config();
//import express
let express = require('express');
let app = express();
//import mongoose
let mongoose = require('mongoose');
let cors = require('cors');
//import geocoding
let { geocodeLocation } = require('./geocode');
//create server
let http = require('http');
let server = http.createServer(app);
//import socket.io
let socketIo = require('socket.io');
//setup socket.io
let io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

//connect models to mongoose
let MissedConnection = require('./models/missedconnection');
app.use(cors()); //enable CORS for all routes
//serve static files from public folder
app.use ('/', express.static('public'));
//middleware to parse JSON bodies
app.use(express.json());
//connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
console.log('Connected to MongoDB');
})
.catch((err) => {
console.error('Error connecting to MongoDB:', err);
});

io.on('connection', (socket) => {
    console.log('new client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('client disconnected:', socket.id);
    });
});

//get all missed connections
app.get('/api/connections', async (req, res) => {
    try {
        let connections = await MissedConnection.find().sort({ createdAt: -1 });
        res.json(connections);
    } catch (error) {
        console.error('error fetching connections:', error);
        res.status(500).json({ error: 'failed to fetch connections' });
    }
});

//create new missed connection
app.post('/api/connections', async (req, res) => {
    try {
        let { title, location, description } = req.body;
        
        if (!location || !description) {
            return res.status(400).json({ error: 'location and description are required' });
        }
        
        console.log('geocoding location:', location);
        let coordinates = await geocodeLocation(location);
        console.log('coordinates:', coordinates);
        
        let newConnection = new MissedConnection({
            title: title || 'anonymous',
            location,
            description,
            coordinates
        });
        
        await newConnection.save();
        console.log('saved new connection:', newConnection._id);
        
        io.emit('newConnection', newConnection);
        
        res.status(201).json(newConnection);
    } catch (error) {
        console.error('error creating connection:', error);
        res.status(500).json({ error: 'failed to create connection: ' + error.message });
    }
});

//start server
let PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
console.log(`Server running on http://localhost:${PORT}`);
});