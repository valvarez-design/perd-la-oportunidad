let fetch = require('node-fetch');

// NYC Open Data API endpoint - FREE, no API key needed!
const NYC_ADDRESS_API = "https://data.cityofnewyork.us/resource/uf93-f8nk.json";

// Geocoding function using NYC Open Data
async function geocodeLocation(location) {
    try {
        console.log('Geocoding with NYC Open Data:', location);
        
        // Clean up the location string
        let cleanLocation = location.trim();
        
        // Build the query URL with filters
        // $limit=5 gets top 5 results
        // $where clause filters for valid lat/lon
        let url = `${NYC_ADDRESS_API}?$q=${encodeURIComponent(cleanLocation)}&$limit=5&$where=latitude IS NOT NULL AND longitude IS NOT NULL`;
        
        // Make the request
        let response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`NYC API error: ${response.status}`);
        }
        
        // Parse the JSON response
        let data = await response.json();
        
        // Check if we got results
        if (data && data.length > 0) {
            console.log(`Found ${data.length} results for "${location}":`);
            
            // Log all results for debugging
            data.forEach((result, i) => {
                let address = `${result.house_number || ''} ${result.street_name || ''}, ${result.boroname || ''}`.trim();
                console.log(`  ${i + 1}. ${address}`);
            });
            
            // Use the first result
            let firstResult = data[0];
            let coordinates = {
                lat: parseFloat(firstResult.latitude),
                lng: parseFloat(firstResult.longitude)
            };
            
            let fullAddress = `${firstResult.house_number || ''} ${firstResult.street_name || ''}, ${firstResult.boroname || ''}`.trim();
            console.log(`Using: ${fullAddress} (${coordinates.lat}, ${coordinates.lng})`);
            
            return coordinates;
        } else {
            throw new Error('Location not found in NYC Open Data');
        }
    } catch (error) {
        console.error('Geocoding error:', error.message);
        throw error;
    }
}

module.exports = { geocodeLocation };