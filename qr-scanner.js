let html5QrCode = null;
let scannedData = [];
let totalDevices = 0;
let listTitle = '';
let videoTrack = null;
let flashlightEnabled = false;
let availableCameras = [];
let selectedCameraId = null;

async function startScanning() {
    listTitle = document.getElementById('listTitle').value.trim();
    totalDevices = parseInt(document.getElementById('numDevices').value);

    if (!listTitle) {
        alert('Please enter a list title');
        return;
    }

    if (!totalDevices || totalDevices < 1) {
        alert('Please enter a valid number of devices');
        return;
    }

    scannedData = [];
    flashlightEnabled = false;
    document.getElementById('setupForm').classList.add('hidden');
    document.getElementById('scannerSection').classList.remove('hidden');
    updateScanProgress();

    // List available cameras
    await listCameras();

    // Start with selected camera or default
    startCamera();
}

async function listCameras() {
    try {
        availableCameras = await Html5Qrcode.getCameras();
        const cameraSelect = document.getElementById('cameraSelect');
        
        if (availableCameras && availableCameras.length > 0) {
            cameraSelect.innerHTML = '';
            availableCameras.forEach((camera, index) => {
                const option = document.createElement('option');
                option.value = camera.id;
                option.text = camera.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });

            // Default to the last camera in the list (camera 0 back camera)
            const lastCameraIndex = availableCameras.length - 1;
            selectedCameraId = availableCameras[lastCameraIndex].id;
            cameraSelect.value = availableCameras[lastCameraIndex].id;

            // Add event listener for camera change
            cameraSelect.onchange = function() {
                selectedCameraId = this.value;
                restartCamera();
            };
        } else {
            cameraSelect.innerHTML = '<option>No cameras found</option>';
        }
    } catch (err) {
        console.error("Error listing cameras:", err);
        document.getElementById('cameraSelect').innerHTML = '<option>Unable to list cameras</option>';
    }
}

async function restartCamera() {
    if (html5QrCode) {
        await stopScanning();
    }
    startCamera();
}

function startCamera() {
    // Initialize QR Code scanner with verbose mode
    html5QrCode = new Html5Qrcode("reader", /* verbose= */ false);
    
    // Use selected camera ID or fallback to environment facing
    const cameraConfig = selectedCameraId || { facingMode: "environment" };

    const scanConfig = {
        fps: 10,
        qrbox: 200, // Fixed smaller box for small QR codes (1cm x 1cm)
        aspectRatio: 1.0
    };
    
    html5QrCode.start(
        cameraConfig,
        scanConfig,
        onScanSuccess,
        onScanError
    ).then(() => {
        console.log("Scanner started successfully");
        // Get video track to control flashlight
        getVideoTrack();
    }).catch(err => {
        console.error("Camera error:", err);
        let errorMsg = "Unable to access camera.\n\n";
        errorMsg += "Please ensure:\n";
        errorMsg += "1. You're using HTTPS (camera access requires secure connection)\n";
        errorMsg += "2. Camera permissions are allowed in browser settings\n";
        errorMsg += "3. No other app is using the camera\n\n";
        errorMsg += "On mobile: Check Settings → Safari/Chrome → Camera permissions";
        alert(errorMsg);
        stopAndReturn();
    });
}

function onScanSuccess(decodedText, decodedResult) {
    // Check if we've already scanned this QR code
    const alreadyScanned = scannedData.some(item => item.text === decodedText);
    
    if (alreadyScanned) {
        // Show duplicate alert
        const duplicateAlert = document.getElementById('duplicateAlert');
        duplicateAlert.classList.remove('hidden');
        
        setTimeout(() => {
            duplicateAlert.classList.add('hidden');
        }, 2000);
        
        console.log("Duplicate QR code detected, ignoring:", decodedText);
        return;
    }

    // Check if we haven't reached the limit
    if (scannedData.length < totalDevices) {
        scannedData.push({
            id: scannedData.length + 1,
            text: decodedText
        });

        updateScanProgress();

        // If we've scanned all required devices, stop scanning
        if (scannedData.length >= totalDevices) {
            stopScanning();
            showResults();
        }
    }
}

function onScanError(errorMessage) {
    // Ignore scan errors (they happen frequently during scanning)
}

function updateScanProgress() {
    const count = scannedData.length;
    document.getElementById('scanCount').textContent = `scanned: ${count} / ${totalDevices}`;
    const percentage = (count / totalDevices) * 100;
    document.getElementById('progressFill').style.width = percentage + '%';
}

async function stopScanning() {
    if (html5QrCode) {
        // Turn off flashlight before stopping
        if (flashlightEnabled && videoTrack) {
            try {
                await videoTrack.applyConstraints({
                    advanced: [{ torch: false }]
                });
                flashlightEnabled = false;
            } catch (err) {
                console.error("Error turning off flashlight:", err);
            }
        }
        
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
            videoTrack = null;
        } catch (err) {
            console.error("Error stopping scanner:", err);
        }
    }
}

function showResults() {
    document.getElementById('scannerSection').classList.add('hidden');
    document.getElementById('resultsSection').classList.remove('hidden');

    const listContainer = document.getElementById('scannedList');
    listContainer.innerHTML = '';

    scannedData.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'scanned-item';
        itemDiv.innerHTML = `
            <label>device ${item.id}</label>
            <input type="text" id="item-${index}" value="${escapeHtml(item.text)}" />
        `;
        listContainer.appendChild(itemDiv);
    });
}

function saveToXML() {
    // Update scannedData with edited values
    scannedData.forEach((item, index) => {
        const input = document.getElementById(`item-${index}`);
        if (input) {
            item.text = input.value;
        }
    });

    // Create XML document
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<ScanList title="${escapeXml(listTitle)}">\n`;
    xml += `  <Devices count="${totalDevices}">\n`;

    scannedData.forEach(item => {
        xml += `    <Device id="${item.id}">\n`;
        xml += `      <Text>${escapeXml(item.text)}</Text>\n`;
        xml += `    </Device>\n`;
    });

    xml += '  </Devices>\n';
    xml += '</ScanList>';

    // Download XML file
    // const blob = new Blob([xml], { type: 'application/xml' });
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = `${listTitle.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.xml`;
    // document.body.appendChild(a);
    // a.click();
    // document.body.removeChild(a);
    // URL.revokeObjectURL(url);

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Create readable date-time stamp (YYYY-MM-DD_HH-MM-SS)
    const now = new Date();
    const dateTimeStamp = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') + '-' +
        String(now.getMinutes()).padStart(2, '0') + '-' +
        String(now.getSeconds()).padStart(2, '0');

    a.download = `${listTitle.replace(/[^a-z0-9]/gi, '_')}_${dateTimeStamp}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success message
    const successMsg = document.getElementById('successMessage');
    successMsg.textContent = 'XML file saved successfully!';
    successMsg.classList.remove('hidden');

    setTimeout(() => {
        successMsg.classList.add('hidden');
    }, 3000);
}

function resetApp() {
    scannedData = [];
    totalDevices = 0;
    listTitle = '';

    document.getElementById('listTitle').value = '';
    document.getElementById('numDevices').value = '';
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('setupForm').classList.remove('hidden');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function skipCurrentScan() {
    // Add a placeholder entry
    scannedData.push({
        id: scannedData.length + 1,
        text: ''
    });

    updateScanProgress();

    // If we've reached the total, show results
    if (scannedData.length >= totalDevices) {
        stopScanning();
        showResults();
    }
}

async function stopAndReturn() {
    await stopScanning();
    document.getElementById('scannerSection').classList.add('hidden');
    document.getElementById('setupForm').classList.remove('hidden');
    scannedData = [];
}

async function getVideoTrack() {
    try {
        // Get the video element from the scanner
        const videoElement = document.querySelector('#reader video');
        if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject;
            const tracks = stream.getVideoTracks();
            if (tracks.length > 0) {
                videoTrack = tracks[0];
                
                // Apply 2x zoom by default for small QR codes
                await applyZoom(2.0);
            }
        }
    } catch (err) {
        console.error("Error getting video track:", err);
    }
}

async function applyZoom(zoomLevel) {
    if (!videoTrack) {
        return;
    }

    try {
        const capabilities = videoTrack.getCapabilities();
        
        if (capabilities.zoom) {
            const settings = videoTrack.getSettings();
            const currentZoom = settings.zoom || 1.0;
            const maxZoom = capabilities.zoom.max || 1.0;
            const minZoom = capabilities.zoom.min || 1.0;
            
            // Ensure zoom level is within supported range
            const targetZoom = Math.min(Math.max(zoomLevel, minZoom), maxZoom);
            
            await videoTrack.applyConstraints({
                advanced: [{ zoom: targetZoom }]
            });
            
            console.log(`Zoom applied: ${targetZoom}x`);
        } else {
            console.log("Zoom not supported on this device");
        }
    } catch (err) {
        console.error("Error applying zoom:", err);
    }
}

/*async function toggleFlashlight() {
    if (!videoTrack) {
        await getVideoTrack();
    }

    if (!videoTrack) {
        alert("Flashlight not available. This feature requires a camera with flash support.");
        return;
    }

    try {
        const capabilities = videoTrack.getCapabilities();
        
        if (!capabilities.torch) {
            alert("Your device doesn't support flashlight control through the browser.");
            return;
        }

        flashlightEnabled = !flashlightEnabled;
        
        await videoTrack.applyConstraints({
            advanced: [{ torch: flashlightEnabled }]
        });

        // Update button text
        const btn = document.getElementById('flashlightBtn');
        if (flashlightEnabled) {
            btn.textContent = 'Turn Off Flashlight';
        } else {
            btn.textContent = 'Turn On Flashlight';
        }
    } catch (err) {
        console.error("Error toggling flashlight:", err);
        alert("Unable to control flashlight. This feature may not be supported on your device.");
    }
}*/
