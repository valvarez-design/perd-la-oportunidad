let fetch = require('node-fetch');

//geocoding function using Mapbox for better NYC accuracy
async function geocodeLocation(location) {
    try {
        // Get Mapbox token from environment
        let mapboxToken = process.env.MAPBOX_TOKEN;
        
        if (!mapboxToken) {
            throw new Error('MAPBOX_TOKEN not found in environment variables');
        }
        
        // Add NYC context to improve results
        let query = `${location}, New York City, NY`;
        
        // Mapbox Geocoding API endpoint
        // bbox parameter limits results to NYC area for better accuracy
        let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=1&bbox=-74.259090,40.477399,-73.700272,40.917577`;
        
        console.log('Geocoding with Mapbox:', location);
        
        //make request
        let response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Mapbox API error: ${response.status}`);
        }
        
        //parse response
        let data = await response.json();
        
        //check if we got results
        if (data.features && data.features.length > 0) {
            let coordinates = data.features[0].geometry.coordinates;
            // Mapbox returns [lng, lat], we need {lat, lng}
            return {
                lng: coordinates[0],
                lat: coordinates[1]
            };
        } else {
            throw new Error('Location not found in NYC area');
        }
    } catch (error) {
        console.error('Geocoding error:', error.message);
        throw error;
    }
}

//export the function
module.exports = { geocodeLocation };