// Global state variables
let recognition = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audio = null;
let currentTab = 'transcript';
let currentLine = null;

// Constants
const ErrorTypes = {
    RECORDING: 'RECORDING',
    TRANSCRIPTION: 'TRANSCRIPTION',
    NETWORK: 'NETWORK',
    PERMISSION: 'PERMISSION'
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Initialization Functions
async function initializePage() {
    try {
        console.log('Initializing page...');
        await window.app.initializeCommon();
        setupEventListeners();
        
        // Initialize transcript content visibility
        const transcriptContent = document.getElementById('transcript-content');
        const transcriptArea = document.querySelector('.transcript-area');
        if (transcriptContent && transcriptArea) {
            transcriptContent.style.display = 'block';
            transcriptArea.style.display = 'block';
        }
        
        // Get recording ID from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        const mode = urlParams.get('mode') || 'view';
        
        if (id) {
            await loadRecording(id);
            if (mode === 'view') {
                updateBottomBar('view', id);
            }
        }
        
        await setupTabListeners();
        await generateSummary();
        console.log('Page initialization complete');
    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Failed to initialize page. Please refresh and try again.');
    }
}

// UI Setup Functions
function setupEventListeners() {
    console.log('Setting up event listeners...');
    const recordButton = document.getElementById('recordButton');
    if (recordButton) {
        recordButton.addEventListener('click', toggleRecording);
        console.log('Record button listener added');
    }

    let transcriptArea = document.querySelector('.transcript-area');
    if (!transcriptArea) {
        transcriptArea = document.createElement('div');
        transcriptArea.className = 'transcript-area';
        const transcriptContent = document.querySelector('#transcript-content');
        if (transcriptContent) {
            transcriptContent.appendChild(transcriptArea);
        }
    }

    if (!document.querySelector('.results')) {
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'results';
        transcriptArea.appendChild(resultsDiv);
    }
}

async function setupTabListeners() {
    console.log('Setting up tab listeners...');
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            if (!tabName) return;
            
            if (isRecording && tabName !== 'transcript') {
                showError('Cannot switch tabs while recording');
                return;
            }
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            contents.forEach(content => {
                if (content.id === `${tabName}-content`) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });
            
            currentTab = tabName;
            
            if (tabName === 'transcript') {
                const transcriptArea = document.querySelector('.transcript-area');
                if (transcriptArea) {
                    transcriptArea.style.display = 'block';
                }
            }
        });
    });
    
    const regenerateButton = document.getElementById('regenerate-summary');
    if (regenerateButton) {
        regenerateButton.addEventListener('click', generateSummary);
    }
}

// Recording Functions
async function setupRecording() {
    try {
        console.log('Setting up recording...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted');
        
        // Use the global recognition variable instead of redeclaring
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event) => {
            const transcriptArea = document.querySelector('.transcript-area');
            if (!transcriptArea) {
                console.error('Transcript area not found');
                return;
            }
            
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.trim();
            
            if (!currentLine) {
                currentLine = document.createElement('div');
                currentLine.className = 'transcript-line';
                
                const timestamp = document.createElement('div');
                timestamp.className = 'timestamp';
                timestamp.textContent = new Date().toLocaleTimeString();
                currentLine.appendChild(timestamp);
                
                const textDiv = document.createElement('div');
                textDiv.className = 'text';
                currentLine.appendChild(textDiv);
                
                transcriptArea.appendChild(currentLine);
            }
            
            const textDiv = currentLine.querySelector('.text');
            textDiv.textContent = transcript;
            
            if (result.isFinal) {
                currentLine = null;
            }
            
            transcriptArea.scrollTop = transcriptArea.scrollHeight;
        };
        
        recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            showError(`Speech recognition error: ${event.error}`);
        };
        
        recognition.onend = () => {
            if (isRecording) {
                recognition.start();
            }
        };

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        console.log('Recording setup complete');
        return true;
    } catch (error) {
        console.error('Error setting up recording:', error);
        showError('Failed to setup recording. Please check your microphone permissions.');
        return false;
    }
}

async function toggleRecording() {
    console.log('Toggle recording called. Current state:', isRecording);
    try {
        if (!recognition) {
            if (!await setupRecording()) return;
        }

        isRecording = !isRecording;
        const button = document.querySelector('.record-button');
        if (!button) return;

        if (isRecording) {
            try {
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.style.display = content.id === 'transcript-content' ? 'block' : 'none';
                });
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.classList.toggle('active', tab.getAttribute('data-tab') === 'transcript');
                });
                currentTab = 'transcript';
                
                const transcriptArea = document.querySelector('.transcript-area');
                if (transcriptArea) {
                    transcriptArea.style.display = 'block';
                }
                
                recognition.start();
                mediaRecorder.start();
                audioChunks = [];
                window.app.startRecording();
                button.textContent = 'Stop Recording';
                button.classList.add('recording');
                console.log('Recording started');
            } catch (error) {
                console.error('Error starting recording:', error);
                isRecording = false;
                showError('Failed to start recording. Please try again.');
                return;
            }
        } else {
            try {
                recognition.stop();
                mediaRecorder.stop();
                const duration = window.app.stopRecording();
                button.textContent = 'Start Recording';
                button.classList.remove('recording');
                
                const transcriptArea = document.querySelector('.transcript-area');
                if (transcriptArea) {
                    transcriptArea.style.display = 'block';
                }
                
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const transcriptText = Array.from(document.querySelectorAll('.transcript-line .text'))
                        .map(el => el.textContent)
                        .join(' ');
                    
                    try {
                        await saveRecording(audioBlob, transcriptText, duration);
                    } catch (error) {
                        console.error('Failed to save recording:', error);
                        showError('Failed to save recording. Please try again.');
                    }
                };
                console.log('Recording stopped');
            } catch (error) {
                console.error('Error stopping recording:', error);
                showError('Error stopping recording. Please refresh and try again.');
            }
        }
    } catch (error) {
        console.error('Error in toggleRecording:', error);
        isRecording = false;
        showError('Recording error occurred. Please refresh and try again.');
    }
}

// Utility Functions
function showError(message) {
    console.error('Error:', message);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.content-area').prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function parseTimeToSeconds(timeString) {
    const parts = timeString.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return 0;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

async function loadRecording(id) {
    try {
        console.log('Loading recording:', id);
        const transcriptArea = document.querySelector('.transcript-area');
        if (!transcriptArea) return;

        updateBottomBar('view', id);
        
        const savedTranscript = localStorage.getItem(`transcript_${id}`);
        if (savedTranscript) {
            const transcriptLines = JSON.parse(savedTranscript);
            transcriptLines.forEach(line => {
                const lineDiv = document.createElement('div');
                lineDiv.className = 'transcript-line';
                
                const timestamp = document.createElement('div');
                timestamp.className = 'timestamp';
                timestamp.textContent = line.timestamp;
                lineDiv.appendChild(timestamp);
                
                const text = document.createElement('div');
                text.className = 'text';
                text.textContent = line.text;
                lineDiv.appendChild(text);
                
                transcriptArea.appendChild(lineDiv);
            });
        }

        await loadAudioFile(id);
        console.log('Recording loaded successfully');
    } catch (err) {
        console.error('Error loading recording:', err);
        showError('Failed to load recording. Please try again.');
    }
}

async function loadAudioFile(id) {
    try {
        console.log('Loading audio file...');
        const response = await fetch(`${window.app.getApiUrl()}/recordings/${id}/audio`);
        if (!response.ok) {
            throw new Error(`Failed to load audio: ${response.status}`);
        }
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        
        setupAudioPlayer(audioUrl);
        console.log('Audio file loaded successfully');
    } catch (err) {
        console.error('Error loading audio:', err);
        showError('Failed to load audio file. Please try again.');
    }
}

async function saveRecording(audioBlob, transcriptText, duration) {
    console.log('Saving recording...');
    try {
        // Convert audio blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
        });
        reader.readAsDataURL(audioBlob);
        const base64Audio = await base64Promise;

        const response = await fetch(`${window.app.getApiUrl()}/recordings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audio: base64Audio,
                title: `Recording_${new Date().toISOString()}`,
                transcript: transcriptText,
                duration: duration
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result && result.id) {
            const transcriptLines = Array.from(document.querySelectorAll('.transcript-line'))
                .map(line => ({
                    timestamp: line.querySelector('.timestamp').textContent,
                    text: line.querySelector('.text').textContent
                }));
            localStorage.setItem(`transcript_${result.id}`, JSON.stringify(transcriptLines));
            
            window.location.href = `/transcript?id=${result.id}&mode=view`;
            console.log('Recording saved successfully');
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        console.error('Error saving recording:', error);
        throw error; // Re-throw to be handled by the caller
    }
}

// Audio Playback Functions
function setupAudioPlayer(audioUrl) {
    console.log('Setting up audio player...');
    if (audio) {
        audio.pause();
        audio.src = '';
        URL.revokeObjectURL(audio.src);
    }
    
    audio = new Audio(audioUrl);
    
    audio.addEventListener('loadedmetadata', () => {
        document.getElementById('duration').textContent = formatTime(audio.duration);
    });
    
    audio.addEventListener('timeupdate', updatePlaybackTime);
    audio.addEventListener('ended', () => {
        document.getElementById('playButton').textContent = '⏵';
        updatePlaybackTime();
    });
    
    audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        showError('Failed to play audio. Please try again.');
    });
    
    setupWaveformControls();
    console.log('Audio player setup complete');
}

function setupWaveformControls() {
    const waveform = document.querySelector('.waveform');
    if (waveform && audio) {
        waveform.addEventListener('click', (e) => {
            if (!audio.duration) return;
            const rect = waveform.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            audio.currentTime = percentage * audio.duration;
            updatePlaybackTime();
        });
    }
}

function updateBottomBar(mode, id) {
    console.log('Updating bottom bar:', mode);
    const bottomBar = document.querySelector('.bottom-bar');
    if (!bottomBar) return;

    if (mode === 'view') {
        bottomBar.innerHTML = `
            <div class="audio-controls">
                <div class="control-buttons">
                    <button id="playButton" class="control-button">⏵</button>
                    <button id="stopButton" class="control-button">⏹</button>
                </div>
                <div class="waveform">
                    <div class="waveform-background"></div>
                    <div id="progressBar" class="progress-bar"></div>
                </div>
                <div class="time-display">
                    <span id="currentTime" class="timer">0:00</span>
                    <span class="timer-separator">/</span>
                    <span id="duration" class="timer">0:00</span>
                </div>
            </div>
        `;
        
        const playButton = document.getElementById('playButton');
        const stopButton = document.getElementById('stopButton');
        if (playButton && stopButton) {
            playButton.addEventListener('click', togglePlayback);
            stopButton.addEventListener('click', stopPlayback);
        }
    } else {
        bottomBar.innerHTML = `<div class="record-button" id="recordButton">Start Recording</div>`;
        const recordButton = document.getElementById('recordButton');
        if (recordButton) {
            recordButton.addEventListener('click', toggleRecording);
        }
    }
}

function togglePlayback() {
    if (!audio) return;
    
    const playButton = document.getElementById('playButton');
    if (!playButton) return;
    
    try {
        if (audio.paused) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        playButton.textContent = '⏸';
                    })
                    .catch(error => {
                        console.error('Playback failed:', error);
                        showError('Failed to play audio. Please try again.');
                    });
            }
        } else {
            audio.pause();
            playButton.textContent = '⏵';
        }
    } catch (error) {
        console.error('Error in playback:', error);
        showError('Playback error occurred. Please try again.');
    }
}

function stopPlayback() {
    if (!audio) return;
    
    audio.pause();
    audio.currentTime = 0;
    document.getElementById('playButton').textContent = '⏵';
    updatePlaybackTime();
}

function updatePlaybackTime() {
    if (!audio) return;
    
    try {
        const currentTime = Math.floor(audio.currentTime);
        const duration = Math.floor(audio.duration) || 0;
        const progress = duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
        
        // Update times
        document.getElementById('currentTime').textContent = formatTime(currentTime);
        document.getElementById('duration').textContent = formatTime(duration);
        
        // Update progress bar
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        // Highlight current transcript line
        const timestamps = Array.from(document.querySelectorAll('.timestamp'));
        timestamps.forEach((timestamp, index) => {
            const time = parseTimeToSeconds(timestamp.textContent);
            const nextTime = index < timestamps.length - 1 
                ? parseTimeToSeconds(timestamps[index + 1].textContent)
                : Infinity;
                
            const line = timestamp.closest('.transcript-line');
            if (currentTime >= time && currentTime < nextTime) {
                line.classList.add('current');
                const rect = line.getBoundingClientRect();
                const containerRect = line.parentElement.getBoundingClientRect();
                if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
                    line.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                line.classList.remove('current');
            }
        });
    } catch (error) {
        console.error('Error updating playback time:', error);
    }
}

// Summary Functions
async function generateSummary() {
    const summaryText = document.getElementById('summary-text');
    if (!summaryText) return;
    
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if (!id) {
            console.log('No recording ID found - skipping summary generation');
            return;
        }

        summaryText.innerHTML = `
            <div class="loading-placeholder">
                <div class="loading-spinner"></div>
                <div class="loading-text">Generating summary...</div>
            </div>
        `;
        
        const response = await fetch(`${window.app.getApiUrl()}/recordings/${id}/summary`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate summary');
        }
        
        const result = await response.json();
        if (!result.content) {
            throw new Error('Invalid response from server');
        }
        
        summaryText.innerHTML = `
            <div class="summary-content">
                <p>${sanitizeHTML(result.content)}</p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error generating summary:', error);
        if (error.message !== 'No recording ID found') {
            summaryText.innerHTML = `
                <div class="error-message">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">${error.message}</div>
                </div>
            `;
        }
    }
}

// Cleanup function
function cleanup() {
    try {
        if (recognition) {
            if (recognition.state === 'active') {
                recognition.stop();
            }
            recognition = null;
        }
        
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        mediaRecorder = null;
        
        audioChunks = [];
        isRecording = false;
        currentLine = null;

        if (audio) {
            audio.pause();
            audio = null;
        }
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Event Listeners
window.addEventListener('beforeunload', cleanup);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing page...');
    initializePage();
});