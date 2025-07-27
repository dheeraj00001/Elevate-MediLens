// Constants
// IMPORTANT: In a real-world application, NEVER expose API keys on the client-side.
// This should be handled by a backend server that makes requests to the APIs.
const GEMINI_API_KEY = "AIzaSyC7yMPuAh7oonSrpyS4nmYw3SM7KNVHl8o"; 
const TTS_API_KEY = "AIzaSyBnJtOtipb1vpC5GODlmmcocJzWEk2Uono";
const OPENFDA_API_KEY = 'qhKd4B3ghjZVGgcVgmXm2NB5zzHFgge36dXyNU0y';
// *** ADD YOUR YOUTUBE API KEY HERE ***
const YOUTUBE_API_KEY = 'AIzaSyBcfKX8kvfNuv6iNPhJuQu8CnKnxZzsZZU'; // Replace with your actual YouTube Data API v3 key

// Global state
let currentMode = 'upload';
let isProcessing = false;
let currentStream = null;
let isMuted = false;
let currentAudio = null; // To hold the current playing Audio object
let userProfile = { allergies: [], currentMedications: [] };
let currentRating = 5;
let selectedLanguage = 'en-US'; // Default language
let latestAnalysisResult = null; // To store the last analysis for reporting
let lastProcessedImageData = null; // To store the last processed image for reporting

// DOM elements
const languageSelect = document.getElementById('language-select');
const uploadModeBtn = document.getElementById('upload-mode-btn');
const cameraModeBtn = document.getElementById('camera-mode-btn');
const uploadSection = document.getElementById('upload-section');
const cameraSection = document.getElementById('camera-section');
const processingSection = document.getElementById('processing-section');
const resultsSection = document.getElementById('results-section');
const newScanSection = document.getElementById('new-scan-section');
const alertsSection = document.getElementById('alerts-section');
const reportSection = document.getElementById('report-section');

const imageUpload = document.getElementById('imageUpload');
const imagePreview = document.getElementById('image-preview');
const dropArea = document.getElementById('drop-area');
const liveVideo = document.getElementById('live-video');
const scanLabelBtn = document.getElementById('scan-label-btn');
const retakeBtn = document.getElementById('retake-btn');

const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

const readAloudBtn = document.getElementById('read-aloud-btn');
const volumeBtn = document.getElementById('volume-btn');
const tabTriggers = document.querySelectorAll('.tab-trigger');
const tabContents = document.querySelectorAll('.tab-content');
const youtubeVideosContainer = document.getElementById('youtube-videos');

const allergiesInput = document.getElementById('allergies');
const medicationsInput = document.getElementById('medications');
const saveProfileBtn = document.getElementById('save-profile-btn');

const feedbackForm = document.getElementById('feedback-form');
const ratingInput = document.getElementById('rating-input');
const newScanBtn = document.getElementById('new-scan-btn');

const jsonReportBtn = document.getElementById('json-report-btn');
const emailReportBtn = document.getElementById('email-report-btn');
const pdfReportBtn = document.getElementById('pdf-report-btn'); 

// Supported Languages for the dropdown
const supportedLanguages = {
    'en-US': 'English (US)', 'es-US': 'Spanish (US)', 'fr-FR': 'French (France)',
    'de-DE': 'German (Germany)', 'hi-IN': 'Hindi (India)', 'it-IT': 'Italian (Italy)',
    'ja-JP': 'Japanese (Japan)', 'ko-KR': 'Korean (Korea)', 'pt-BR': 'Portuguese (Brazil)',
    'ru-RU': 'Russian (Russia)', 'ar-EG': 'Arabic (Egyptian)', 'bn-BD': 'Bengali (Bangladesh)',
    'id-ID': 'Indonesian (Indonesia)', 'mr-IN': 'Marathi (India)', 'nl-NL': 'Dutch (Netherlands)',
    'pl-PL': 'Polish (Poland)', 'ro-RO': 'Romanian (Romania)', 'ta-IN': 'Tamil (India)',
    'te-IN': 'Telugu (India)', 'th-TH': 'Thai (Thailand)', 'tr-TR': 'Turkish (Turkey)',
    'uk-UA': 'Ukrainian (Ukraine)', 'vi-VN': 'Vietnamese (Vietnam)'
};

// Utility functions
function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-description">${message}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

function showError(message) { showToast('Error', message, 'error'); }
function showSuccess(message) { showToast('Success', message, 'success'); }
function updateProgress(value, text) {
    progressBar.style.width = value + '%';
    progressText.textContent = text;
}

function resetUI() {
    isProcessing = false;
    processingSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    newScanSection.classList.add('hidden');
    alertsSection.classList.add('hidden');
    reportSection.classList.add('hidden');
    imagePreview.classList.add('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = 'Processing image...';
    stopCamera();
    stopAudio();
    if (imageUpload) imageUpload.value = '';
    lastProcessedImageData = null;
    youtubeVideosContainer.innerHTML = ''; // Clear YouTube videos
    switchMode('upload');
    // Reset to the first tab
    tabTriggers.forEach((t, i) => t.classList.toggle('active', i === 0));
    tabContents.forEach((c, i) => c.classList.toggle('active', i === 0));
}

// Mode switching
function switchMode(mode) {
    currentMode = mode;
    if (mode === 'upload') {
        uploadModeBtn.className = 'btn btn-primary';
        cameraModeBtn.className = 'btn btn-outline';
        uploadSection.classList.remove('hidden');
        cameraSection.classList.add('hidden');
        stopCamera();
    } else {
        uploadModeBtn.className = 'btn btn-outline';
        cameraModeBtn.className = 'btn btn-primary';
        uploadSection.classList.add('hidden');
        cameraSection.classList.remove('hidden');
        startCamera();
    }
}

// Image processing
function resizeImage(file, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let { width, height } = img;
            if (width > height) {
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
            } else {
                if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => reject(new Error("Failed to load image for resizing."));
        img.src = URL.createObjectURL(file);
    });
}

// YouTube API Functions
async function searchYouTubeVideos(brandName, genericName, strength) {
    if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY' || !YOUTUBE_API_KEY) {
        console.warn("YouTube API key is not set. Skipping video search.");
        return [];
    }

    // Prioritize generic name for a more reliable search
    const searchTerm = genericName || brandName;

    if (!searchTerm) {
        console.log("No medication name available for YouTube search.");
        return [];
    }
    
    // A more focused and less restrictive query
    const query = `${searchTerm} medication guide uses side effects`;

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=6&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            // Check for quota exceeded error specifically
            if (errorData.error && errorData.error.message.toLowerCase().includes('quota')) {
                 showError('YouTube video search limit reached for today. Please try again tomorrow.');
            } else {
                throw new Error(`YouTube API request failed: ${errorData.error ? errorData.error.message : 'Unknown error'}`);
            }
            return [];
        }
        const data = await response.json();
        
        // If no results, try a broader search with just the name
        if (data.items.length === 0) {
            console.log(`No videos found for "${query}". Trying a broader search for "${searchTerm}".`);
            const broaderUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=6&q=${encodeURIComponent(searchTerm)}&type=video&key=${YOUTUBE_API_KEY}`;
            const broaderResponse = await fetch(broaderUrl);
            if (broaderResponse.ok) {
                const broaderData = await broaderResponse.json();
                return broaderData.items.map(item => ({
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.medium.url,
                    description: item.snippet.description
                }));
            }
        }
        
        return data.items.map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.medium.url,
            description: item.snippet.description
        }));
    } catch (error) {
        showError('Failed to fetch YouTube videos: ' + error.message);
        return [];
    }
}


function displayYouTubeVideos(videos) {
    youtubeVideosContainer.innerHTML = ''; // Clear previous videos
    if (videos.length === 0) {
        youtubeVideosContainer.innerHTML = '<p class="text-muted">No relevant educational videos found.</p>';
        return;
    }
    videos.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.innerHTML = `
            <a href="https://www.youtube.com/watch?v=${video.videoId}" target="_blank">
                <img src="${video.thumbnail}" alt="${video.title}" onerror="this.onerror=null;this.src='https://placehold.co/280x160/e0e0e0/757575?text=Video';">
            </a>
            <h4>${video.title}</h4>
            <p>${video.description.substring(0, 100)}...</p>
            <a href="https://www.youtube.com/watch?v=${video.videoId}" target="_blank" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.8rem;">
                <i class="fas fa-play-circle"></i> Watch Video
            </a>
        `;
        youtubeVideosContainer.appendChild(videoCard);
    });
}


// API calls
async function getMedicationDetails(medicationName) {
    // Do not proceed if the medication name is invalid or not found.
    if (!medicationName || medicationName.toLowerCase().includes('not clearly visible')) {
        return '';
    }
    
    const url = `https://api.fda.gov/drug/label.json?api_key=${OPENFDA_API_KEY}&search=openfda.brand_name:"${encodeURIComponent(medicationName)}"&limit=1`;
    const maxRetries = 3;
    let lastError = null;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url);

            // Handle non-successful responses
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`No drug information found in openFDA for "${medicationName}"`);
                    return ''; // 404 is a definitive "not found", no need to retry
                }
                // For other server errors, throw an error to trigger a retry
                throw new Error(`Server responded with status ${response.status}`);
            }

            const data = await response.json();

            // Process successful response
            if (data.results && data.results.length > 0) {
                const drug = data.results[0];
                let info = '';
                if (drug.indications_and_usage && drug.indications_and_usage[0]) {
                    info += `Indications: ${drug.indications_and_usage[0]}. `;
                }
                if (drug.warnings && drug.warnings[0]) {
                    info += `Warnings: ${drug.warnings[0]}`;
                }
                return info.trim();
            }
            return ''; // Return empty if no results are found
        } catch (error) {
            lastError = error;
            console.error(`FDA API Fetch Attempt ${i + 1} failed:`, error);
            if (i < maxRetries - 1) {
                await new Promise(res => setTimeout(res, 1000)); // Wait 1 second before retrying
            }
        }
    }
    
    // If all retries fail, show a toast and return empty
    showToast('FDA Connection Failed', 'Could not retrieve data from the FDA database. The report will be generated without it.', 'warning');
    return '';
}

async function getConsolidatedAiAnalysis(base64ImageData, fdaInfoEnglish, userProfile, languageCode) {
    const prompt = `
    You are a medical-label parser.
    Analyze the medication label image and the context below. Output exactly one valid JSON object with these keys, in this order:
    {
      "brandName": "",
      "genericName": "",
      "strength": "",
      "primaryUse": "",
      "instructions": "",
      "warnings": "",
      "fdaSummary": "",
      "quickFacts": [],
      "personalizedAlert": ""
    }

    CONTEXT:
    - Target Language Code: ${languageCode}
    - User Profile:
      - Allergies: ${(userProfile.allergies || []).join(', ') || 'None'}
      - Current Medications: ${(userProfile.currentMedications || []).join(', ') || 'None'}
    - Additional FDA Information (in English): """${fdaInfoEnglish}"""
    
    REQUIREMENTS:
    1.  **Language**: All text-based values in the final JSON object ('primaryUse', 'instructions', 'warnings', 'fdaSummary', 'quickFacts', 'personalizedAlert') MUST be in the language specified by the 'Target Language Code'. For example, if the Target Language Code is 'en-US', the output must be in English. If it is 'es-US', the output must be in Spanish.
    2.  **Non-Translated Fields**: 'brandName', 'genericName', and 'strength' should be extracted as-is from the label and MUST NOT be translated.
    3.  **Content Generation**:
        -   **primaryUse**: Summarize main indications in one sentence.
        -   **instructions**: Mirror physician-prescribed dosing guidance.
        -   **warnings**: Major safety warnings.
        -   **fdaSummary**: Summarize the key points from the 'Additional FDA Information' context. If the context is empty, return an empty string.
        -   **quickFacts**: Create an array of 3-5 bullet-style facts.
        -   **personalizedAlert**: Create one custom alert based on the user's profile and the medication. If no specific alert is needed, provide a general safety tip.
    4.  **Format**: Do NOT include any extra keys, comments, or explanatory text—only the JSON object.
    `;

    const payload = {
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: base64ImageData.split(',')[1] } }] }]
    };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini API Error:", errorBody);
        throw new Error(`Gemini API request failed with status ${response.status}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Invalid response structure from Gemini API');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to extract JSON from AI response.');
    try { 
        return JSON.parse(jsonMatch[0]);
    } catch (e) { 
        throw new Error('Failed to parse JSON from AI response.'); 
    }
}


// Google Cloud Text-to-Speech
async function getAndPlayAudio(text) {
    if (isMuted || !text || typeof text !== 'string' || text.trim() === '' || isProcessing) {
        readAloudBtn.innerHTML = '<i class="fas fa-play"></i> Listen';
        readAloudBtn.disabled = false;
        return;
    }
    stopAudio();
    
    readAloudBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    readAloudBtn.disabled = true;

    try {
        const payload = {
            input: { text: text },
            voice: { languageCode: selectedLanguage, ssmlGender: 'NEUTRAL' },
            audioConfig: { audioEncoding: 'MP3' }
        };

        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error("TTS API Error:", errorBody);
            if (errorBody.error && errorBody.error.message.includes('5000 bytes')) {
                 throw new Error('The generated text is too long for audio playback.');
            }
            throw new Error(errorBody.error.message || 'Text-to-Speech API request failed.');
        }

        const data = await response.json();
        const audioContent = data.audioContent;
        if (!audioContent) {
            throw new Error('No audio data received from API.');
        }
        
        currentAudio = new Audio(`data:audio/mpeg;base64,${audioContent}`);
        currentAudio.muted = isMuted;
        
        currentAudio.onplay = () => {
            readAloudBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
            readAloudBtn.disabled = false;
        };
        currentAudio.onended = () => {
            readAloudBtn.innerHTML = '<i class="fas fa-play"></i> Listen';
            currentAudio = null;
        };
        
        const playPromise = currentAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Audio playback failed:", error);
                showError("Audio playback failed. Please click the 'Listen' button.");
                readAloudBtn.innerHTML = '<i class="fas fa-play"></i> Listen';
                readAloudBtn.disabled = false;
            });
        }

    } catch (error) {
        showError(error.message || 'Failed to generate audio.');
        readAloudBtn.innerHTML = '<i class="fas fa-play"></i> Listen';
        readAloudBtn.disabled = false;
    }
}

function stopAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
        readAloudBtn.innerHTML = '<i class="fas fa-play"></i> Listen';
        readAloudBtn.disabled = false;
    }
}

// Camera functions
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        liveVideo.srcObject = stream;
        currentStream = stream;
    } catch (error) { showError('Unable to access camera. Please check permissions.'); }
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

function captureFrame() {
    if (!currentStream) { showError("Camera is not active."); return; }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = liveVideo.videoWidth;
    canvas.height = liveVideo.videoHeight;
    ctx.drawImage(liveVideo, 0, 0);
    const dataURL = canvas.toDataURL('image/jpeg', 0.8);
    stopCamera();
    handleImageProcessing(dataURL);
}

// Main processing function
async function handleImageProcessing(imageData) {
    isProcessing = true;
    lastProcessedImageData = imageData; // Store image data for reporting
    processingSection.classList.remove('hidden');
    uploadSection.classList.add('hidden');
    cameraSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    newScanSection.classList.add('hidden');
    
    try {
        updateProgress(10, 'Analyzing image...');
        const initialAnalysis = await getConsolidatedAiAnalysis(imageData, "", userProfile, selectedLanguage);
        const { brandName, genericName, strength } = initialAnalysis;

        updateProgress(30, 'Fetching FDA data...');
        const fdaInfoEnglish = await getMedicationDetails(brandName || genericName);

        updateProgress(50, 'Searching for educational videos...');
        const youtubeVideos = await searchYouTubeVideos(brandName, genericName, strength);

        updateProgress(75, 'Performing comprehensive AI analysis...');
        const analysisResult = await getConsolidatedAiAnalysis(imageData, fdaInfoEnglish, userProfile, selectedLanguage);
        
        latestAnalysisResult = analysisResult;
        
        updateProgress(100, 'Finalizing results...');
        displayResults(analysisResult);
        displayYouTubeVideos(youtubeVideos);
        
        const hasAlert = analysisResult.personalizedAlert && analysisResult.personalizedAlert.trim() !== "";
        
        // Automatically read the personalized alert if it exists.
        if (hasAlert) {
            getAndPlayAudio(analysisResult.personalizedAlert);
        }
        
    } catch (error) {
        showError(error.message || 'Failed to analyze the image. Please try again.');
        resetUI();
    } finally {
        isProcessing = false;
        processingSection.classList.add('hidden');
    }
}

function displayResults(analysisResult) {
    const { brandName, genericName, strength, instructions, primaryUse, warnings, fdaSummary, quickFacts, personalizedAlert } = analysisResult;

    // Quick Facts Tab
    const quickFactsContainer = document.getElementById('quick-facts-container');
    quickFactsContainer.innerHTML = ''; // Clear previous
    if (quickFacts && quickFacts.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'list-disc list-inside space-y-2 text-lg leading-relaxed';
        quickFacts.forEach(fact => {
            const li = document.createElement('li');
            // FIX: Handle cases where 'fact' might be an object instead of a string.
            if (typeof fact === 'object' && fact !== null) {
                li.textContent = Object.values(fact)[0] || '';
            } else {
                li.textContent = fact;
            }
            ul.appendChild(li);
        });
        quickFactsContainer.appendChild(ul);
    }
    
    // Full summary tab
    const medicationDisplayName = brandName && genericName && brandName.toLowerCase() !== genericName.toLowerCase() ? `${brandName} (${genericName})` : brandName || genericName || 'N/A';
    document.getElementById('full-medication').textContent = medicationDisplayName;
    document.getElementById('full-strength').textContent = strength || 'N/A';
    document.getElementById('full-use').textContent = primaryUse || 'N/A';
    document.getElementById('full-instructions').textContent = instructions || 'N/A';
    
    const notVisible = selectedLanguage === 'en-US' ? 'not clearly visible' : 'స్పష్టంగా కనిపించడం లేదు';
    if (warnings && !warnings.toLowerCase().includes(notVisible.toLowerCase())) {
        document.getElementById('warnings-section').classList.remove('hidden');
        document.getElementById('full-warnings').textContent = warnings;
    } else {
         document.getElementById('warnings-section').classList.add('hidden');
         document.getElementById('full-warnings').textContent = '';
    }
    
    if (fdaSummary) {
        document.getElementById('fda-section').classList.remove('hidden');
        document.getElementById('fda-info').innerHTML = fdaSummary.replace(/•/g, '<br>•');
    } else {
        document.getElementById('fda-section').classList.add('hidden');
    }
    
    // Personalized alerts
    const alertContent = document.getElementById('alert-content');
    alertContent.innerHTML = ''; // Clear previous alerts
    
    const hasAlert = personalizedAlert && personalizedAlert.trim() !== "";

    if (hasAlert) {
        alertContent.innerHTML = `<p>${personalizedAlert}</p>`;
        alertsSection.classList.remove('hidden');
    } else {
        alertsSection.classList.add('hidden');
    }
    
    resultsSection.classList.remove('hidden');
    reportSection.classList.remove('hidden');
    newScanSection.classList.remove('hidden');
}

function downloadReportJSON() {
    if (!latestAnalysisResult) {
        showError("No analysis data available to generate a report.");
        return;
    }
    const jsonString = JSON.stringify(latestAnalysisResult, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MedicationReport_${latestAnalysisResult.brandName || latestAnalysisResult.genericName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// UPDATED: Function to download the report as a PDF using pdfmake
function downloadReportPDF() {
    if (!latestAnalysisResult) {
        showError("No analysis data available to generate a PDF report.");
        return;
    }

    // Prepare data, using 'N/A' as a fallback for missing values.
    const brandName = latestAnalysisResult.brandName || 'N/A';
    const genericName = latestAnalysisResult.genericName || 'N/A';
    const strength = latestAnalysisResult.strength || 'N/A';
    const primaryUse = latestAnalysisResult.primaryUse || 'N/A';
    const instructions = latestAnalysisResult.instructions || 'N/A';
    const warnings = latestAnalysisResult.warnings || '';
    const fdaSummary = latestAnalysisResult.fdaSummary || '';
    const personalizedAlert = latestAnalysisResult.personalizedAlert || '';
    const quickFacts = Array.isArray(latestAnalysisResult.quickFacts) ? latestAnalysisResult.quickFacts : [];

    const medicationDisplayName = brandName && genericName && brandName.toLowerCase() !== genericName.toLowerCase() 
        ? `${brandName} (${genericName})` 
        : brandName;

    // Build the content array for pdfmake
    let content = [
        { text: 'Elevate MediLens', style: 'mainHeader' },
        { text: 'Medication Analysis Report', style: 'subHeader', margin: [0, 0, 0, 20] },
        {
            style: 'section',
            table: {
                widths: ['*'],
                body: [
                    [{ text: 'Medication Identification', style: 'sectionHeader', fillColor: '#eeeeee' }],
                    [{ text: [ { text: 'Name: ', bold: true }, medicationDisplayName ] }],
                    [{ text: [ { text: 'Strength: ', bold: true }, strength ] }]
                ]
            },
            layout: 'noBorders'
        }
    ];

    if (personalizedAlert.trim() !== "") {
        content.push({
            style: 'alertSection',
            table: {
                widths: ['*'],
                body: [
                    [{ text: 'Personalized Health Alert', style: 'alertHeader', fillColor: '#fffbe6' }],
                    [{ text: personalizedAlert, margin: [5, 5, 5, 5] }]
                ]
            },
            layout: {
                hLineWidth: function (i, node) { return (i === 0 || i === node.table.body.length) ? 1 : 0; },
                vLineWidth: function (i, node) { return 0; },
                hLineColor: function (i, node) { return '#ffe58f'; },
            }
        });
    }

    if (quickFacts.length > 0) {
        content.push({
            style: 'section',
            table: {
                widths: ['*'],
                body: [
                    [{ text: 'Quick Facts', style: 'sectionHeader', fillColor: '#eeeeee' }],
                    [{ ul: quickFacts, margin: [15, 5, 5, 5] }]
                ]
            },
            layout: 'noBorders'
        });
    }
    
    let fullSummaryContent = [
        { text: [ { text: 'Primary Use: ', bold: true }, primaryUse ] },
        { text: [ { text: 'Instructions: ', bold: true }, instructions ] }
    ];

    if (warnings.trim() !== "") {
        fullSummaryContent.push({ text: [ { text: 'Warnings: ', bold: true }, warnings ] });
    }
    if (fdaSummary.trim() !== "") {
        fullSummaryContent.push({ text: [ { text: 'FDA Information: ', bold: true }, fdaSummary ] });
    }

    content.push({
        style: 'section',
        table: {
            widths: ['*'],
            body: [
                [{ text: 'Full Summary', style: 'sectionHeader', fillColor: '#eeeeee' }],
                [{ stack: fullSummaryContent, margin: [5, 5, 5, 5] }]
            ]
        },
        layout: 'noBorders'
    });

    if (lastProcessedImageData) {
        content.push({ text: 'Scanned Label Image', style: 'sectionHeader', margin: [0, 15, 0, 5], pageBreak: 'before' });
        content.push({
            image: lastProcessedImageData,
            width: 250,
            alignment: 'center'
        });
    }

    // Define the document definition
    const docDefinition = {
        content: content,
        styles: {
            mainHeader: { fontSize: 22, bold: true, alignment: 'center', color: '#005a9c' },
            subHeader: { fontSize: 16, alignment: 'center', color: '#333' },
            section: { margin: [0, 0, 0, 10] },
            alertSection: { margin: [0, 0, 0, 10] },
            sectionHeader: { fontSize: 14, bold: true, color: '#005a9c', margin: [5, 5, 5, 5] },
            alertHeader: { fontSize: 14, bold: true, color: '#d46b08', margin: [5, 5, 5, 5] },
        },
        defaultStyle: {
            fontSize: 10,
            lineHeight: 1.15
        },
        footer: function(currentPage, pageCount) { 
            return { 
                text: 'This report is for informational purposes only. Always consult a healthcare professional. Page ' + currentPage.toString() + ' of ' + pageCount, 
                alignment: 'center', 
                fontSize: 8, 
                italics: true,
                margin: [0, 20, 0, 0]
            }; 
        }
    };

    pdfMake.createPdf(docDefinition).download(`MediLens_Report_${brandName || genericName || 'Scan'}.pdf`);
}


function shareReportEmail() {
     if (!latestAnalysisResult) {
        showError("No analysis data available to generate a report.");
        return;
    }
    const { brandName, genericName, strength, quickFacts, personalizedAlert } = latestAnalysisResult;
    const subject = `Medication Report for ${brandName || genericName}`;
    
    // FIX: Properly format the quickFacts array to handle objects instead of strings.
    const formattedQuickFacts = (quickFacts || []).map(fact => {
        if (typeof fact === 'object' && fact !== null) {
            return Object.values(fact)[0] || '';
        }
        return fact;
    }).join('\n- ');

    let body = `Hello,\n\nHere is my medication report generated by Elevate MediLens:\n\n`;
    body += `Medication: ${brandName || genericName} (${strength || 'N/A'})\n\n`;
    
    // FIX: Avoid redundant "Active Ingredient" if brand and generic names are the same.
     if (brandName && genericName && brandName.toLowerCase() !== genericName.toLowerCase()) {
        body += `(Active Ingredient: ${genericName})\n\n`;
    }
    if (personalizedAlert) {
        body += `IMPORTANT ALERT:\n${personalizedAlert}\n\n`;
    }
    body += `Quick Facts:\n- ${formattedQuickFacts}\n\n`;
    body += `Please review this information.\n\nThank you.`;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
}


// Profile & Language management
function saveProfile() {
    userProfile = {
        allergies: allergiesInput.value.split(',').map(s => s.trim()).filter(Boolean),
        currentMedications: medicationsInput.value.split(',').map(s => s.trim()).filter(Boolean)
    };
    localStorage.setItem('medilens_profile', JSON.stringify(userProfile));
    showSuccess('Profile saved successfully!');
}

function loadProfile() {
    try {
        const saved = localStorage.getItem('medilens_profile');
        if (saved) {
            const loadedProfile = JSON.parse(saved);
            // Ensure the loaded profile has the expected structure
            userProfile.allergies = loadedProfile.allergies || [];
            userProfile.currentMedications = loadedProfile.currentMedications || [];
            
            allergiesInput.value = userProfile.allergies.join(', ');
            medicationsInput.value = userProfile.currentMedications.join(', ');
        }
    } catch (error) {
        console.error("Failed to load or parse user profile from localStorage:", error);
        // Reset to default if there's an error
        userProfile = { allergies: [], currentMedications: [] };
        localStorage.removeItem('medilens_profile');
    }
}

function populateLanguageDropdown() {
    for (const [code, name] of Object.entries(supportedLanguages)) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name;
        languageSelect.appendChild(option);
    }
}

function loadLanguagePreference() {
    const savedLang = localStorage.getItem('medilens_language');
    if (savedLang && supportedLanguages[savedLang]) {
        selectedLanguage = savedLang;
        languageSelect.value = savedLang;
    }
}

// Event listeners
uploadModeBtn.addEventListener('click', () => {
    switchMode('upload');
    imageUpload.click();
});
cameraModeBtn.addEventListener('click', () => switchMode('camera'));

imageUpload.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
        const resizedImage = await resizeImage(file, 1024, 1024);
        imagePreview.src = resizedImage;
        imagePreview.classList.remove('hidden');
        handleImageProcessing(resizedImage);
    } catch (error) { showError(error.message); }
});

dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.style.borderColor = 'var(--primary)'; });
dropArea.addEventListener('dragleave', () => { dropArea.style.borderColor = 'var(--border)'; });
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = 'var(--border)';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        imageUpload.files = e.dataTransfer.files;
        imageUpload.dispatchEvent(new Event('change'));
    }
});

// Added event listener for the drop area to trigger file input click
dropArea.addEventListener('click', () => {
    imageUpload.click();
});

scanLabelBtn.addEventListener('click', captureFrame);
retakeBtn.addEventListener('click', startCamera);

readAloudBtn.addEventListener('click', () => {
    if (currentAudio && !currentAudio.paused) {
        stopAudio();
        return;
    }

    if (!latestAnalysisResult) {
        showError("No analysis data to read.");
        return;
    }

    const activeTab = document.querySelector('.tab-trigger.active').dataset.tab;
    let textToRead = '';

    if (activeTab === 'brief') {
        textToRead = latestAnalysisResult.quickFacts ? latestAnalysisResult.quickFacts.join('. ') : 'No quick facts available.';
    } else if (activeTab === 'full') {
        const { brandName, genericName, strength, primaryUse, instructions, warnings } = latestAnalysisResult;
        const medicationDisplayName = brandName || genericName || 'Not available';
        let fullSummaryParts = [
            `Medication Name: ${medicationDisplayName}.`
        ];
        if (brandName && genericName) {
            fullSummaryParts.push(`The active ingredient is ${genericName}.`);
        }
        fullSummaryParts.push(
            `Strength: ${strength || 'Not available'}.`,
            `Primary Use: ${primaryUse || 'Not available'}.`,
            `Instructions: ${instructions || 'Not available'}.`
        );
        if (warnings && !warnings.toLowerCase().includes('not clearly visible')) {
            fullSummaryParts.push(`Warnings: ${warnings}.`);
        }
        textToRead = fullSummaryParts.join(' ');
    }
    
    getAndPlayAudio(textToRead);
});

volumeBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    volumeBtn.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    if (currentAudio) currentAudio.muted = isMuted;
    if (isMuted) stopAudio();
});

tabTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
        tabTriggers.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        trigger.classList.add('active');
        document.getElementById(`${trigger.dataset.tab}-content`).classList.add('active');
    });
});

saveProfileBtn.addEventListener('click', saveProfile);

languageSelect.addEventListener('change', (e) => {
    selectedLanguage = e.target.value;
    localStorage.setItem('medilens_language', selectedLanguage);
    showSuccess(`Language set to ${supportedLanguages[selectedLanguage]}`);
});

document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
        currentRating = parseInt(star.dataset.rating);
        ratingInput.value = currentRating;
        document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < currentRating));
    });
});

feedbackForm.addEventListener('submit', () => showSuccess('Thank you for your feedback!'));
newScanBtn.addEventListener('click', resetUI);

jsonReportBtn.addEventListener('click', downloadReportJSON);
emailReportBtn.addEventListener('click', shareReportEmail);
pdfReportBtn.addEventListener('click', downloadReportPDF); 


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    populateLanguageDropdown();
    loadLanguagePreference();
    loadProfile();
    resetUI();
});

window.addEventListener('beforeunload', () => {
    stopCamera();
    stopAudio();
});
