console.log("map page loaded");

//initialize socket.io connection
let socket = io();

socket.on('connect', () => {
    console.log('connected to server via socket.io');
});

socket.on('disconnect', () => {
    console.log('disconnected from server');
});

//initialize map centered on new york city + define bounds
let map = L.map('map', {
    preferCanvas: true, //stabilizes rendering of heart markers
    maxBounds: [[40.4774, -74.2591], [40.9176, -73.7004]], // NYC map bounds
    maxBoundsViscosity: 1.0, //prevents panning outside bounds
    minZoom: 11, //minimum zoom
    maxZoom: 19, //maximum zoom
}).setView([40.7128, -74.0060], 12); //center on NYC




//add tile layer to map
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

//custom heart icon for markers on map
let heartIcon = L.divIcon({
    className: 'custom-heart-marker',
    html: '<svg width="30" height="30" viewBox="0 0 24 24" fill="orchid" stroke="#ff69b4" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
});

//variable to hold selected location coordinates
let selectedLocation = null;

//create suggestions dropdown...will do eventually
let locationInput = document.getElementById('locationinput');
let suggestionsDiv = document.createElement('div');
suggestionsDiv.className = 'suggestions-dropdown';
locationInput.parentNode.insertBefore(suggestionsDiv, locationInput.nextSibling);

//geocoding autocomplete
let geocodeTimeout;
locationInput.addEventListener('input', async (e) => {
    clearTimeout(geocodeTimeout);
    let query = e.target.value.trim();

    if (query.length < 3) {
        suggestionsDiv.style.display = 'none';
        return;
    }

//show loading message
    suggestionsDiv.innerHTML = 'loading...';
    suggestionsDiv.style.display = 'block';

//debounce geocoding requests
    geocodeTimeout = setTimeout(async (e) => {
        try {
            let response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                let result = await response.json();
                suggestionsDiv.innerHTML = `<div class="suggestion-item" onclick="selectLocation(${result.lat}, ${result.lng}, '${result.formattedAddress.replace(/'/g, "\\'")}')"><strong>${result.formattedAddress}</strong><br><small>Click to select</small></div>`;
            } else {
                suggestionsDiv.innerHTML = '<div class="suggestion-item error">Not found in NYC</div>';
            }
        }  catch (error) {
    suggestionsDiv.innerHTML = '<div class="suggestion-item error">Location not found</div>';
    console.error('geocoding error:', error);
        }
    }, 500);
});

//function to select location from suggestions
function selectLocation(lat, lng, address) {
    selectedLocation = { lat, lng };
    locationInput.value = address;
    suggestionsDiv.style.display = 'none';
    //add temporary marker to map
    if (window.tempMarker) map.removeLayer(window.tempMarker);
    window.tempMarker = L.marker([lat, lng], { icon: heartIcon }).addTo(map)
        .bindPopup('Your connection will appear here').openPopup();
    map.setView([lat, lng], 16);
}

//function to add marker to map
function addMarkerToMap(connection) {
    let { coordinates, title, location, description, createdAt } = connection;
    //date formatting
    let date = new Date(createdAt);    // Use toLocaleString to include both date and time
    let formattedDate = date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    //create marker
    let marker = L.marker([coordinates.lat, coordinates.lng], { icon: heartIcon })
        .addTo(map);
    //create popup content
    let popupContent = `
        <div class="connection-popup">
            <h3 style="color: orchid; margin-top: 0;">${title}</h3>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>
            <p style="margin: 5px 0;"><strong>Description:</strong> ${description}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #999;">${formattedDate}</p>
        </div>
    `;
    //bind popup to marker
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
    });
    //animate marker with pulse effect
    let markerElement = marker.getElement();
    if (markerElement) {
        markerElement.classList.add('pulse');
        setTimeout(() => {
            markerElement.classList.remove('pulse');
        }, 3000);
    }
}

//load existing connections when page loads
async function loadExistingConnections() {
    try {
        let response = await fetch('/api/connections');
        let connections = await response.json();
        console.log('loaded', connections.length, 'existing connections');

        connections.forEach(connection => {
            addMarkerToMap(connection);
        });
    } catch (error) {
        console.error('error loading connections:', error);
    }
}

//listen for new connections from socket.io
socket.on('newConnection', (connection) => {
    console.log('new connection received:', connection);
    addMarkerToMap(connection);
});

//load existing connections on intial page load
loadExistingConnections();

//handle form submission
document.getElementById('submitBtn').addEventListener('click', function () {
    let location = document.getElementById('locationinput').value;
    let description = document.getElementById('descriptioninput').value;

    //validate inputs
    if (location && description) {
        console.log('location:', location);
        console.log('description:', description);

        //add marker to map at specified location + save to database 
        let title = document.getElementById('title').value;
        //update button state
        this.textContent = 'submitting...';
        this.disabled = true;
        //post to server
        fetch('/api/connections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                location,
                description,
                ...(selectedLocation && { coordinates: selectedLocation })
            })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('failed to submit connection');
                }
                return response.json();
            })
            .then(newConnection => {
                console.log('connection saved:', newConnection);


                //reset form
                document.getElementById('locationinput').value = '';
                document.getElementById('descriptioninput').value = '';

                document.getElementById('title').value = '';
                alert('your missed connection has been added!');
                //remove temporary marker after successful submission
                if (window.tempMarker) {
                    map.removeLayer(window.tempMarker);
                    window.tempMarker = null;
                }

                this.textContent = 'Submit';
                this.disabled = false;
            }) 
            .catch(error => {
                console.error('error submitting connection:', error);
                alert('oops! something went wrong. please try again.');

                this.textContent = 'Submit';
                this.disabled = false;
            });
    } else {
        alert('Oops! Please enter both the location and description.');
    }
})