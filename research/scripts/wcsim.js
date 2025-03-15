/**
 * WCSim 3D Web Demonstration
 * 
 * This script provides an interactive 3D web-based demonstration of a Water Cherenkov detector
 * simulation, inspired by the WCSim software (https://github.com/WCSim/WCSim).
 * 
 * It uses Three.js to create a 3D visualization of particle tracks and Cherenkov light
 * in a water detector, similar to the actual WCSim visualization.
 */

// Particle parameters
const particleColors = {
    electron: 0xFFD700, // gold
    muon: 0xFFFFFF,     // white
    neutron: 0x00FFFF   // cyan
};

const particleDescriptions = {
    electron: {
        title: 'Electron (e⁻)',
        energy: '5 MeV',
        description: 'Electrons produce a fuzzy, scattered Cherenkov light pattern due to their light mass and tendency to scatter and shower. The light green color represents the electron track in the detector.',
        physics: 'Electrons travel at speeds greater than the speed of light in water, producing Cherenkov radiation in a cone around their path. They quickly lose energy through ionization and bremsstrahlung, creating electromagnetic showers.'
    },
    muon: {
        title: 'Muon (μ⁻)',
        energy: '500 MeV',
        description: 'Muons produce clear, ring-shaped Cherenkov light patterns as they travel in relatively straight lines through the detector. The white color represents the muon track. At 500 MeV, a muon will trigger approximately half of the PMTs in the detector.',
        physics: 'Muons are about 200 times heavier than electrons, so they travel in straighter paths and produce clearer Cherenkov rings. They lose energy primarily through ionization but travel much farther than electrons before stopping.'
    },
    neutron: {
        title: 'Neutron (n)',
        energy: '10 MeV',
        description: 'Neutrons themselves do not produce Cherenkov light as they are electrically neutral. The cyan color shows the neutron\'s path. In this simulation, neutrons are captured at around 1m from their starting point, producing 3-5 electrons (shown in gold color) that create Cherenkov light.',
        physics: 'Neutrons interact with water primarily through elastic scattering with hydrogen nuclei. When captured, they produce electrons through various processes. These electrons then produce Cherenkov light as they travel through the water at speeds greater than the speed of light in water.'
    }
};

// Three.js variables
let scene, camera, renderer, controls;
let detector, pmtGroup, particleGroup, lightGroup;
let autoRotate = false; // Default rotation speed is 0
let rotationSpeed = 0.0001;

// Detector parameters
const detectorRadius = 40; // Changed from 40 to 17 as per user's specification
const detectorHeight = 80; // Changed to maintain the same aspect ratio
const pmtRadius = 0.3; // Smaller PMT markers
const pmtCount = 12000; // Realistic number of PMTs for a large water Cherenkov detector
const pmts = [];

// Animation variables
let animationFrame = null;
let animationStep = 0;
let particleTrack = [];
let currentParticleType = null;
let activePMTs = [];
let lightBeams = [];

// Initialize the 3D scene
function initScene() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(60, 600 / 400, 0.1, 1000);
    camera.position.set(0, 0, 150);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(600, 400);
    
    // Add renderer to DOM
    const container = document.getElementById('wcsim-canvas-container');
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    // Add orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Create groups for organizing objects
    pmtGroup = new THREE.Group();
    particleGroup = new THREE.Group();
    lightGroup = new THREE.Group();
    scene.add(pmtGroup);
    scene.add(particleGroup);
    scene.add(lightGroup);
    
    // Create detector
    createDetector();
    
    // Start animation loop
    animate();
    
    // Add event listener for rotation speed
    document.getElementById('rotation-speed').addEventListener('input', function(e) {
        rotationSpeed = e.target.value / 10000;
    });
    
    // Add event listener for reset view button
    document.getElementById('reset-view-btn').addEventListener('click', function() {
        camera.position.set(0, 0, 150);
        camera.lookAt(0, 0, 0);
        controls.reset();
    });
}

// Create the detector geometry
function createDetector() {
    // Create transparent detector cylinder
    const detectorGeometry = new THREE.CylinderGeometry(detectorRadius, detectorRadius, detectorHeight, 64);
    const detectorMaterial = new THREE.MeshPhongMaterial({
        color: 0x0066FF,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide
    });
    detector = new THREE.Mesh(detectorGeometry, detectorMaterial);
    scene.add(detector);
    
    // Create PMTs
    const pmtGeometry = new THREE.SphereGeometry(pmtRadius, 8, 8); // Reduced geometry complexity for performance
    const pmtMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
    
    // Calculate PMT distribution
    // We'll place PMTs on the cylinder walls and the top/bottom caps
    
    // Calculate surface areas to determine PMT distribution
    const sideArea = 2 * Math.PI * detectorRadius * detectorHeight;
    const capArea = Math.PI * detectorRadius * detectorRadius * 2; // Both caps
    const totalArea = sideArea + capArea;
    
    // Distribute PMTs proportionally to surface area
    const wallPMTCount = Math.floor(pmtCount * (sideArea / totalArea));
    const capPMTCount = Math.floor(pmtCount * (capArea / totalArea) / 2); // Split between top and bottom
    
    console.log(`Wall PMTs: ${wallPMTCount}, Cap PMTs: ${capPMTCount * 2}`);
    
    // Calculate grid dimensions for wall PMTs
    const circumference = 2 * Math.PI * detectorRadius;
    const pmtSpacing = Math.sqrt((sideArea) / wallPMTCount); // Approximate spacing between PMTs
    
    const numRows = Math.floor(detectorHeight / pmtSpacing);
    const numCols = Math.floor(circumference / pmtSpacing);
    
    console.log(`PMT grid: ${numRows} rows x ${numCols} columns`);
    
    // Place PMTs on the cylinder walls in a grid pattern
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            // Calculate position
            const theta = (col / numCols) * Math.PI * 2;
            const y = (row / (numRows - 1)) * detectorHeight - detectorHeight / 2;
            
            const x = detectorRadius * Math.cos(theta);
            const z = detectorRadius * Math.sin(theta);
            
            const pmt = new THREE.Mesh(pmtGeometry, pmtMaterial.clone());
            pmt.position.set(x, y, z);
            
            // Make PMT face outward from cylinder wall
            const normal = new THREE.Vector3(x, 0, z).normalize();
            pmt.lookAt(pmt.position.clone().add(normal));
            
            pmtGroup.add(pmt);
            pmts.push({
                mesh: pmt,
                position: new THREE.Vector3(x, y, z),
                active: false,
                intensity: 0
            });
        }
    }
    
    // Calculate grid dimensions for cap PMTs
    const capPmtSpacing = Math.sqrt((Math.PI * detectorRadius * detectorRadius) / capPMTCount);
    const capGridSize = Math.ceil(2 * detectorRadius / capPmtSpacing);
    
    // Place PMTs on the top and bottom caps in a grid pattern
    for (let cap = 0; cap < 2; cap++) {
        const capY = cap === 0 ? detectorHeight / 2 : -detectorHeight / 2;
        const direction = cap === 0 ? -1 : 1; // Top PMTs face down, bottom PMTs face up
        
        // Use a grid pattern with rejection sampling for the circular cap
        for (let i = 0; i < capGridSize; i++) {
            for (let j = 0; j < capGridSize; j++) {
                // Map grid coordinates to cap coordinates
                const x = (i / (capGridSize - 1) - 0.5) * 2 * detectorRadius;
                const z = (j / (capGridSize - 1) - 0.5) * 2 * detectorRadius;
                
                // Skip if outside the circle
                if (x*x + z*z > detectorRadius*detectorRadius) continue;
                
                const pmt = new THREE.Mesh(pmtGeometry, pmtMaterial.clone());
                pmt.position.set(x, capY, z);
                
                // Make PMT face the right direction
                pmt.lookAt(new THREE.Vector3(x, capY + direction * 10, z));
                
                pmtGroup.add(pmt);
                pmts.push({
                    mesh: pmt,
                    position: new THREE.Vector3(x, capY, z),
                    active: false,
                    intensity: 0
                });
            }
        }
    }
    
    // Axes helper removed as requested
    
    // Log the actual number of PMTs created
    console.log(`Created ${pmts.length} PMTs`);
}

// Animation loop
function animate() {
    animationFrame = requestAnimationFrame(animate);
    
    // Auto-rotate detector if enabled
    if (autoRotate) {
        detector.rotation.y += rotationSpeed;
        pmtGroup.rotation.y += rotationSpeed;
        particleGroup.rotation.y += rotationSpeed;
        lightGroup.rotation.y += rotationSpeed;
    }
    
    // Update controls
    controls.update();
    
    // Render scene
    renderer.render(scene, camera);
}

// Reset the simulation
function resetSimulation() {
    // Clear particle tracks
    while (particleGroup.children.length > 0) {
        particleGroup.remove(particleGroup.children[0]);
    }
    
    // Clear light beams
    while (lightGroup.children.length > 0) {
        lightGroup.remove(lightGroup.children[0]);
    }
    
    // Reset PMTs
    pmts.forEach(pmt => {
        pmt.mesh.material.color.set(0x444444);
        pmt.mesh.material.emissive = new THREE.Color(0x000000);
        pmt.active = false;
        pmt.intensity = 0;
    });
    
    // Reset animation variables
    particleTrack = [];
    activePMTs = [];
    lightBeams = [];
    animationStep = 0;
}

// Generate a particle track based on type
function generateParticleTrack(type) {
    resetSimulation();
    currentParticleType = type;
    
    // Starting position (center of detector)
    const startPos = new THREE.Vector3(0, 0, 0);
    
    switch (type) {
        case 'electron':
            // Electrons have scattered paths
            let pos = startPos.clone();
            // Random initial direction
            let dir = new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            ).normalize();
            
            for (let i = 0; i < 50; i++) {
                particleTrack.push(pos.clone());
                
                // Random scattering
                dir.x += (Math.random() - 0.5) * 0.4;
                dir.y += (Math.random() - 0.5) * 0.4;
                dir.z += (Math.random() - 0.5) * 0.4;
                dir.normalize();
                
                const step = 2 + Math.random() * 1;
                pos.add(dir.clone().multiplyScalar(step));
                
                // Ensure we stay within detector (cylinder bounds check)
                const distFromAxis = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
                if (distFromAxis > detectorRadius * 0.9 || 
                    Math.abs(pos.y) > detectorHeight * 0.48) {
                    break;
                }
            }
            break;
            
        case 'muon':
            // Muons travel in straight lines
            // Random direction with slight upward bias
            const muonDir = new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 0.5 + 0.5, // Bias upward
                Math.random() * 2 - 1
            ).normalize();
            const muonLength = detectorRadius * 1.8;
            
            for (let i = 0; i < 30; i++) {
                const t = i / 29;
                const pos = startPos.clone().add(muonDir.clone().multiplyScalar(muonLength * t));
                particleTrack.push(pos);
            }
            break;
            
        case 'neutron':
            // Neutrons have some scattering but less than electrons
            let nPos = startPos.clone();
            // Random initial direction
            let nDir = new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            ).normalize();
            
            // Calculate the target distance for neutron capture (random between 10-30 units)
            const captureDistance = 10.0 + Math.random() * 20.0; // Random between 10-30 units
            let totalDistance = 0;
            
            for (let i = 0; i < 40; i++) {
                particleTrack.push(nPos.clone());
                
                // Occasional larger scatters
                if (Math.random() < 0.2) {
                    nDir.x += (Math.random() - 0.5) * 0.8;
                    nDir.y += (Math.random() - 0.5) * 0.8;
                    nDir.z += (Math.random() - 0.5) * 0.8;
                } else {
                    nDir.x += (Math.random() - 0.5) * 0.2;
                    nDir.y += (Math.random() - 0.5) * 0.2;
                    nDir.z += (Math.random() - 0.5) * 0.2;
                }
                nDir.normalize();
                
                const step = 1.0 + Math.random() * 0.5; // Larger steps to allow neutron to travel the full 50 units
                nPos.add(nDir.clone().multiplyScalar(step));
                totalDistance += step;
                
                // Check if we've reached the capture distance
                if (totalDistance >= captureDistance) {
                    break;
                }
                
                // Ensure we stay within detector (cylinder bounds check)
                const distFromAxis = Math.sqrt(nPos.x * nPos.x + nPos.z * nPos.z);
                if (distFromAxis > detectorRadius * 0.9 || 
                    Math.abs(nPos.y) > detectorHeight * 0.48) {
                    break;
                }
            }
            break;
    }
    
    // Draw particle track
    drawParticleTrack();
    
    // Generate PMT hits based on particle type
    generatePMTHits(type);
    
    // Update info panel
    updateInfoPanel(type);
}

// Draw the particle track in 3D
function drawParticleTrack() {
    const material = new THREE.LineBasicMaterial({ 
        color: particleColors[currentParticleType],
        linewidth: 3
    });
    
    const geometry = new THREE.BufferGeometry().setFromPoints(particleTrack);
    const line = new THREE.Line(geometry, material);
    particleGroup.add(line);
    
    // Add small spheres at each point for better visibility
    const sphereGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: particleColors[currentParticleType]
    });
    
    particleTrack.forEach(point => {
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(point);
        particleGroup.add(sphere);
    });
}

// Generate PMT hits based on particle type
function generatePMTHits(type) {
    // Different patterns for different particles
    switch (type) {
        case 'electron':
            // Electrons create scattered PMT hits
            // Select random PMTs for hits
            for (let i = 0; i < 30; i++) {
                const randomPMT = Math.floor(Math.random() * pmtCount);
                activatePMT(randomPMT, 0.7 + Math.random() * 0.3);
            }
            
            // Also activate PMTs near the particle track
            particleTrack.forEach(pos => {
                pmts.forEach((pmt, index) => {
                    const distance = pos.distanceTo(pmt.position);
                    if (distance < detectorRadius * 0.4 && Math.random() < 0.1) {
                        activatePMT(index, 0.6 + Math.random() * 0.4);
                    }
                });
            });
            break;
            
        case 'muon':
            // Muons create clear ring patterns
            // Use the muon's direction for the Cherenkov cone
            // Get the direction from the particle track
            const coneAxis = new THREE.Vector3();
            if (particleTrack.length >= 2) {
                coneAxis.subVectors(particleTrack[1], particleTrack[0]).normalize();
            } else {
                // Fallback if track is too short
                coneAxis.set(0, 1, 0);
            }
            
            const coneAngle = Math.PI / 4; // 45 degrees Cherenkov angle
            
            // For 500 MeV muons, activate about half of the PMTs
            pmts.forEach((pmt, index) => {
                // Calculate angle between PMT position and cone axis
                const pmtDir = pmt.position.clone().normalize();
                const angle = Math.acos(pmtDir.dot(coneAxis));
                
                // Activate PMTs near the cone surface with higher probability
                if (Math.abs(angle - coneAngle) < 0.4) { // Wider angle range
                    // Higher probability of activation for PMTs closer to the cone angle
                    const probability = 1.0 - Math.abs(angle - coneAngle) / 0.4;
                    if (Math.random() < probability) {
                        activatePMT(index, 0.7 + Math.random() * 0.3);
                    }
                }
            });
            break;
            
        case 'neutron':
            // Neutrons themselves don't create Cherenkov light
            // But when captured, they produce 3-5 electron signals as specified
            
            // Simulate capture: create 3-5 electron-like events
            const numElectronSignals = Math.floor(Math.random() * 3) + 3; // 3-5 signals
            
            // Get the capture position (last point in neutron track)
            const capturePos = particleTrack[particleTrack.length - 1].clone();
            
            // Create electron tracks from the capture point
            const electronTracks = [];
            for (let i = 0; i < numElectronSignals; i++) {
                // Create a random direction for each electron
                const electronDir = new THREE.Vector3(
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1
                ).normalize();
                
                // Create electron track
                const electronTrack = [];
                let ePos = capturePos.clone();
                
                // Generate electron path
                for (let j = 0; j < 15; j++) {
                    electronTrack.push(ePos.clone());
                    
                    // Random scattering for electron
                    electronDir.x += (Math.random() - 0.5) * 0.4;
                    electronDir.y += (Math.random() - 0.5) * 0.4;
                    electronDir.z += (Math.random() - 0.5) * 0.4;
                    electronDir.normalize();
                    
                    const step = 0.5 + Math.random() * 0.5;
                    ePos.add(electronDir.clone().multiplyScalar(step));
                    
                    // Ensure we stay within detector
                    const distFromAxis = Math.sqrt(ePos.x * ePos.x + ePos.z * ePos.z);
                    if (distFromAxis > detectorRadius * 0.9 || 
                        Math.abs(ePos.y) > detectorHeight * 0.48) {
                        break;
                    }
                }
                
                electronTracks.push(electronTrack);
                
                // Draw electron track with gold color
                const material = new THREE.LineBasicMaterial({ 
                    color: 0xFFD700, // Gold color for electron tracks
                    linewidth: 2
                });
                
                const geometry = new THREE.BufferGeometry().setFromPoints(electronTrack);
                const line = new THREE.Line(geometry, material);
                particleGroup.add(line);
                
                // Add small spheres at each point for better visibility
                const sphereGeometry = new THREE.SphereGeometry(0.3, 8, 8);
                const sphereMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xFFD700 // Gold color
                });
                
                electronTrack.forEach(point => {
                    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
                    sphere.position.copy(point);
                    particleGroup.add(sphere);
                });
                
                // Activate PMTs for each electron
                electronTrack.forEach(pos => {
                    pmts.forEach((pmt, index) => {
                        const toPMT = pmt.position.clone().sub(pos);
                        const distance = toPMT.length();
                        toPMT.normalize();
                        
                        // Angle between electron direction and PMT
                        const angle = Math.acos(toPMT.dot(electronDir));
                        
                        // Activate PMTs in a cone pattern (Cherenkov light)
                        if (Math.abs(angle - Math.PI/4) < 0.3 && distance < detectorRadius * 0.8) {
                            const probability = 0.7 - Math.abs(angle - Math.PI/4) / 0.3;
                            if (Math.random() < probability) {
                                activatePMT(index, 0.6 + Math.random() * 0.4);
                            }
                        }
                    });
                });
            }
            
            // Ensure approximately 300 PMT hits in total
            const targetHits = 300;
            const currentHits = activePMTs.length;
            
            // If we need more hits, add them randomly
            if (currentHits < targetHits) {
                const additionalHits = targetHits - currentHits;
                const availablePMTs = pmts.filter((pmt, index) => !pmts[index].active);
                
                // Randomly select from available PMTs
                for (let i = 0; i < Math.min(additionalHits, availablePMTs.length); i++) {
                    const randomIndex = Math.floor(Math.random() * availablePMTs.length);
                    const pmtIndex = pmts.indexOf(availablePMTs[randomIndex]);
                    if (pmtIndex >= 0) {
                        activatePMT(pmtIndex, 0.5 + Math.random() * 0.3);
                        availablePMTs.splice(randomIndex, 1); // Remove from available list
                    }
                }
            }
            break;
    }
    
    // Create light beams from particle track to hit PMTs
    createLightBeams();
}

// Activate a PMT and add it to the active list
function activatePMT(index, intensity) {
    const pmt = pmts[index];
    
    // Skip if already active
    if (pmt.active) return;
    
    pmt.active = true;
    pmt.intensity = intensity;
    
    // Change PMT color and make it glow
    pmt.mesh.material.color.set(0x00AAFF);
    pmt.mesh.material.emissive = new THREE.Color(0x0066FF);
    pmt.mesh.material.emissiveIntensity = intensity;
    
    // Add to active PMTs list
    activePMTs.push(index);
}

// Create light beams from particle track to hit PMTs
function createLightBeams() {
    // For each active PMT, find the closest point on the particle track
    activePMTs.forEach(pmtIndex => {
        const pmt = pmts[pmtIndex];
        
        // Find closest point on particle track
        let closestPoint = null;
        let minDistance = Infinity;
        
        particleTrack.forEach(point => {
            const distance = point.distanceTo(pmt.position);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        });
        
        if (closestPoint) {
            // Create a light beam from the track to the PMT
            const beamGeometry = new THREE.BufferGeometry().setFromPoints([
                closestPoint,
                pmt.position
            ]);
            
            const beamMaterial = new THREE.LineBasicMaterial({
                color: 0x00AAFF,
                transparent: true,
                opacity: pmt.intensity * 0.5
            });
            
            const beam = new THREE.Line(beamGeometry, beamMaterial);
            lightGroup.add(beam);
            
            // Add to light beams list
            lightBeams.push(beam);
        }
    });
}

// Update the information panel with particle details
function updateInfoPanel(type) {
    const info = particleDescriptions[type];
    const detailsDiv = document.getElementById('wcsim-details');
    
    detailsDiv.innerHTML = `
        <h4>${info.title}</h4>
        <p><strong>Energy:</strong> ${info.energy}</p>
        <p>${info.description}</p>
        <p><strong>Physics:</strong> ${info.physics}</p>
    `;
}

// Initialize the simulation
function initSimulation() {
    // Initialize Three.js scene
    initScene();
    
    // Add event listeners to buttons
    document.getElementById('electron-btn').addEventListener('click', () => {
        generateParticleTrack('electron');
    });
    
    document.getElementById('muon-btn').addEventListener('click', () => {
        generateParticleTrack('muon');
    });
    
    document.getElementById('neutron-btn').addEventListener('click', () => {
        generateParticleTrack('neutron');
    });
}

// Start the simulation when the page loads
window.addEventListener('load', initSimulation);
