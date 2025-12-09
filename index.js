//load env variables
require('dotenv').config();

//import express
let express = require('express');
let app = express();

//import mongoose
let mongoose = require('mongoose');

let cors = require('cors');

//import socket.io
let socketIo = require('socket.io');

//axios for http requests
let axios = require('axios');

//connect models to mongoose
let MissedConnection = require('./models/missedconnection');

//middleware set up - needs to be b4 routes
app.use(cors()); //enable CORS for all routes
app.use(express.json()); //middleware to parse JSON bodies
app.use('/', express.static('public')); //serve static files from public folder

//connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        console.error('Error connecting to MongoDB:', err);
    });
//geocode function using MULTIPLE NYC Open Data APIs with fallbacks
async function geocodeNYCLocation(locationQuery) {
    
    // Multiple NYC datasets to try
    const NYC_APIS = [
        "https://data.cityofnewyork.us/resource/uf93-f8nk.json", // AddressPoint
        "https://data.cityofnewyork.us/resource/g6pj-hd8k.json", // Address Points (backup)
        "https://data.cityofnewyork.us/resource/f55k-p6yu.json", // MapPLUTO
    ];
    
    let normalized = locationQuery.toUpperCase().trim();
    let houseMatch = normalized.match(/^(\d+)\s+(.+?)(?:,\s*(.+))?$/);

    // Build query params
    let params = {
        "$limit": 5,
        "$select": "house_number, street_name, boroname, latitude, longitude",
    };

    let whereClauses = [];
    if (houseMatch) {
        let houseNum = houseMatch[1];
        let street = houseMatch[2];
        let borough = houseMatch[3];

        whereClauses.push(`house_number='${houseNum}'`);
        whereClauses.push(`UPPER(street_name) LIKE '%${street}%'`);

        if (borough) {
            let boroughMap = {
                "MANHATTAN": "Manhattan",
                "BROOKLYN": "Brooklyn", 
                "QUEENS": "Queens",
                "BRONX": "Bronx",
                "STATEN ISLAND": "Staten Island",
            };
            let boroughName = boroughMap[borough] || borough;
            whereClauses.push(`boroname='${boroughName}'`);
        }
    } else {
        whereClauses.push(`UPPER(street_name) LIKE '%${normalized}%'`);
    }

    if (whereClauses.length > 0) {
        params["$where"] = whereClauses.join(' AND ');
    }

    // Try each API endpoint until one works
    for (let apiUrl of NYC_APIS) {
        try {
            console.log(`Trying ${apiUrl}...`);
            let response = await axios.get(apiUrl, {
                params,
                timeout: 5000,
            });

            if (response.data && response.data.length > 0) {
                let firstResult = response.data[0];
                console.log(`✓ Found via ${apiUrl}: ${firstResult.house_number || ''} ${firstResult.street_name || ''}, ${firstResult.boroname || ''}`);
                
                return {
                    lat: parseFloat(firstResult.latitude),
                    lng: parseFloat(firstResult.longitude),
                    formattedAddress: `${firstResult.house_number || ''} ${firstResult.street_name || ''}, ${firstResult.boroname || ''}`.trim(),
                };
            }
        } catch (error) {
            console.log(`✗ ${apiUrl} failed:`, error.message);
            // Continue to next API
        }
    }

    // If all NYC APIs fail, fallback to Nominatim (OpenStreetMap)
    console.log('All NYC APIs failed, trying Nominatim as fallback...');
    try {
        let query = `${locationQuery}, New York City, NY, USA`;
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`;
        
        let response = await axios.get(url, {
            headers: { 'User-Agent': 'MissedConnectionsNYC/1.0' },
            timeout: 5000
        });
        
        if (response.data && response.data.length > 0) {
            let result = response.data[0];
            console.log(`✓ Found via Nominatim: ${result.display_name}`);
            
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                formattedAddress: result.display_name
            };
        }
    } catch (error) {
        console.log('Nominatim also failed:', error.message);
    }

    console.log('All geocoding methods failed for:', locationQuery);
    return null;
}

//API routes

//get all missed connections
app.get('/api/connections', async (req, res) => {
    try {
        let connections = await MissedConnection.find() //fetch all connections
            .sort({ createdAt: -1 }); //sort by newest first
        res.json(connections); //send as JSON
    } catch (error) {
        console.error('error fetching connections:', error);
        res.status(500).json({ error: 'failed to fetch connections' });
    }
});

//geocode a location
app.get('/api/geocode', async (req, res) => {
    let query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'missing query parameter q' });
    }
    try {
        let result = await geocodeNYCLocation(query);

        if (result) {
            res.json(result);
        } else {
            res.status(404).json({ error: 'uh oh, location not found :(' });
        }
    } catch (error) {
        console.error('geocode API error', error);
        res.status(500).json({ error: 'failed to geocode location' });
    }
});

//create new missed connection
app.post('/api/connections', async (req, res) => {
    try {
        let { title, location, description, coordinates } = req.body;

        if (!location || !description) {
            return res.status(400).json({ error: 'location and description are required' });
        }

        console.log('geocoding location:', location);
        // If coordinates were already provided by client, use them; otherwise geocode
        let geocodeResult = coordinates || await geocodeNYCLocation(location);

        if (!geocodeResult) {
            return res.status(400).json({ error: 'Could not find that NYC location' });
        }
        console.log('geocode result:', geocodeResult);

        coordinates = {
            lat: geocodeResult.lat,
            lng: geocodeResult.lng
        };
        console.log('coordinates:', coordinates);

        let newConnection = new MissedConnection({
            title: title || 'anonymous',
            location: geocodeResult.formattedAddress || location,
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


//create server
let http = require('http');
let server = http.createServer(app);

//set up socket.io
let io = new socketIo.Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});


//socket.io connection
io.on('connection', (socket) => {
    console.log('new client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('client disconnected:', socket.id);
    });
});

//start server
let PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:5000`);
});


