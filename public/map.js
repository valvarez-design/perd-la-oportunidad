console.log("map page loaded");

//initialize socket.io connection
let socket = io();

socket.on('connect', () => {
    console.log('connected to server via socket.io');
});

socket.on('disconnect', () => {
    console.log('disconnected from server');
});

//initialize map centered on new york city
let map = L.map('map').setView([40.7128, -74.0060], 12);

//add tile layer to map
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CartoDB',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

//create custom heart icon for markers
let heartIcon = L.divIcon({
    className: 'custom-heart-marker',
    html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="#FFC0CB" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -20]
});

//function to add marker to map
function addMarkerToMap(connection) {
    let { coordinates, title, location, description, createdAt } = connection;
    
    let date = new Date(createdAt);
    let formattedDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let marker = L.marker([coordinates.lat, coordinates.lng], { icon: heartIcon })
        .addTo(map);
    
    let popupContent = `
        <div class="connection-popup">
            <h3 style="color: orchid; margin-top: 0;">${title}</h3>
            <p style="margin: 5px 0;"><strong>Location:</strong> ${location}</p>
            <p style="margin: 5px 0;"><strong>Description:</strong> ${description}</p>
            <p style="margin: 5px 0; font-size: 12px; color: #999;">${formattedDate}</p>
        </div>
    `;
    
    marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
    });
    
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

//load existing connections on page load
loadExistingConnections();

//handle form submission
document.getElementById('submitBtn').addEventListener('click', function()
{ let location = document.getElementById('locationinput').value;
    let description = document.getElementById('descriptioninput').value;

    //validate inputs
    if(location && description) {
        console.log('location:', location);
        console.log('description:', description);

        //add marker to map at specified location + save to database 
        let title = document.getElementById('title').value;
        
        this.textContent = 'submitting...';
        this.disabled = true;
        
        fetch('/api/connections', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, location, description })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('failed to submit connection');
            }
            return response.json();
        })
        .then(newConnection => {
            console.log('connection saved:', newConnection);

    
    //clear form inputs
    document.getElementById('locationinput').value = '';
    document.getElementById('descriptioninput').value = '';
    
            document.getElementById('title').value = '';
            alert('your missed connection has been added!');
            
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