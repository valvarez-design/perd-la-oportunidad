let fetch = require('node-fetch');

//geocoding function to get lat/lng from address
async function geocodeLocation(location) {
    try {
        let query = `${location}, New York City, NY`;
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        
        //make request
        let response = await fetch(url, {
            headers: {
                'User-Agent': 'MissedConnectionsApp/1.0'
            }
        });
        //parse response
        let data = await response.json();
        
        //check if we got results
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        } else {
            throw new Error('location not found');
        }
    } catch (error) {
        console.error('geocoding error:', error);
        throw error;
    }
}
//export the function
module.exports = { geocodeLocation };