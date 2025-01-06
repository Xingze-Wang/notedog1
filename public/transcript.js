let recognition = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audio = null;
let startTime;
let liveTranscript;
let finalTranscript;
let status;
let createdTime;
let duration;

async function initializePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const id = urlParams.get('id');
    
    updateBottomBar(mode, id);
    
    if (mode === 'playback' && id) {
        await loadRecording(id);
    }
    
    if (mode === 'live') {
        liveTranscript = document.getElementById('live-transcript');
        finalTranscript = document.getElementById('final-transcript');
        status = document.getElementById('status');
        createdTime = document.getElementById('created-time');
        duration = document.getElementById('duration');
        
        createdTime.textContent = new Date().toLocaleString();
        
        if ('webkitSpeechRecognition' in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscriptText = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscriptText += transcript + '\n';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                liveTranscript.textContent = interimTranscript;
                if (finalTranscriptText) {
                    finalTranscript.innerHTML += finalTranscriptText;
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                status.textContent = 'Error: ' + event.error;
            };
        } else {
            status.textContent = 'Speech recognition not supported';
        }
    }
}

async function loadRecording(id) {
    try {
        // Fetch recording metadata
        const response = await fetch(`/recordings/${id}/metadata`);
        const metadata = await response.json();
        
        // Add transcript lines
        if (metadata.transcript) {
            const transcriptArea = document.querySelector('.transcript-area');
            transcriptArea.innerHTML = ''; // Clear existing content
            
            const lines = metadata.transcript.split('. ');
            lines.forEach((line, index) => {
                if (line.trim()) {
                    const timestamp = Math.floor((index * metadata.duration) / lines.length);
                    addTranscriptLine(line.trim(), timestamp);
                }
            });
        }
        
        // Set up audio player
        audio = new Audio(`/recordings/${id}`);
        audio.addEventListener('timeupdate', updatePlaybackTime);
        
        // Update status
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = 'Ready to play';
        }
    } catch (error) {
        console.error('Error loading recording:', error);
    }
}

function updateBottomBar(mode, id) {
    const bottomBar = document.querySelector('.bottom-bar');
    if (mode === 'playback') {
        bottomBar.innerHTML = `
            <div class="audio-controls">
                <div class="control-buttons">
                    <button id="playButton" class="control-button">⏵</button>
                    <button id="stopButton" class="control-button">⏹</button>
                </div>
                <div class="waveform">
                    <div id="progressBar" class="progress-bar"></div>
                </div>
                <div id="currentTime" class="timer">0:00</div>
            </div>
        `;
        
        // Set up playback controls
        document.getElementById('playButton').addEventListener('click', togglePlayback);
        document.getElementById('stopButton').addEventListener('click', stopPlayback);
    } else if (mode === 'live') {
        bottomBar.innerHTML = `
            <button id="startRecording" class="record-button">Start Recording</button>
            <button id="stopRecording" class="record-button" disabled>Stop Recording</button>
            <div id="status"></div>
            <div id="created-time"></div>
            <div id="duration">0:00</div>
            <div id="live-transcript"></div>
            <div id="final-transcript"></div>
        `;
        
        document.getElementById('startRecording').addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                startTime = Date.now();

                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const formData = new FormData();
                    formData.append('audio', audioBlob);
                    formData.append('transcript', finalTranscript.textContent);
                    formData.append('duration', duration.textContent);

                    try {
                        const response = await fetch('/api/recordings', {
                            method: 'POST',
                            body: formData
                        });
                        if (response.ok) {
                            window.location.href = '/';
                        } else {
                            status.textContent = 'Error saving recording';
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        status.textContent = 'Error saving recording';
                    }
                };

                mediaRecorder.start();
                recognition.start();
                
                document.getElementById('startRecording').disabled = true;
                document.getElementById('stopRecording').disabled = false;
                status.textContent = 'Recording...';

                // Update duration
                const updateDuration = () => {
                    if (startTime) {
                        const elapsed = Math.floor((Date.now() - startTime) / 1000);
                        const minutes = Math.floor(elapsed / 60);
                        const seconds = elapsed % 60;
                        duration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    }
                };
                setInterval(updateDuration, 1000);

            } catch (error) {
                console.error('Error:', error);
                status.textContent = 'Error accessing microphone';
            }
        });

        document.getElementById('stopRecording').addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                recognition.stop();
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                
                document.getElementById('startRecording').disabled = false;
                document.getElementById('stopRecording').disabled = true;
                status.textContent = 'Saving recording...';
            }
        });
    } else {
        bottomBar.innerHTML = `<div class="record-button" id="recordButton"></div>`;
        const recordButton = document.querySelector('.record-button');
        recordButton.addEventListener('click', toggleRecording);
    }
}

function togglePlayback() {
    if (!audio) return;
    
    const playButton = document.getElementById('playButton');
    if (audio.paused) {
        audio.play();
        playButton.textContent = '⏸';
    } else {
        audio.pause();
        playButton.textContent = '⏵';
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
    
    const currentTime = Math.floor(audio.currentTime);
    const duration = Math.floor(audio.duration);
    const progress = (audio.currentTime / audio.duration) * 100;
    
    // Update time and progress bar
    document.getElementById('currentTime').textContent = formatTime(currentTime);
    document.getElementById('progressBar').style.width = `${progress}%`;
    
    // Highlight current transcript line
    const timestamps = Array.from(document.querySelectorAll('.timestamp'));
    timestamps.forEach((timestamp, index) => {
        const time = parseTimeToSeconds(timestamp.textContent);
        const nextTime = index < timestamps.length - 1 
            ? parseTimeToSeconds(timestamps[index + 1].textContent)
            : Infinity;
            
        const textElement = timestamp.nextElementSibling;
        if (currentTime >= time && currentTime < nextTime) {
            textElement.style.color = '#007AFF';
        } else {
            textElement.style.color = '#1a1a1a';
        }
    });
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

async function setupRecording() {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        alert('Speech recognition not supported in this browser.');
        return false;
    }

    try {
        // Set up speech recognition
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        // Get audio stream for recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        // Handle audio data
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        setupEventListeners();
        return true;
    } catch (error) {
        console.error('Setup error:', error);
        alert('Error setting up recording. Please check microphone permissions.');
        return false;
    }
}

function setupEventListeners() {
    recognition.onstart = () => {
        console.log('Recognition started');
        document.getElementById('status').textContent = 'Recording...';
    };

    recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        if (event.error === 'not-allowed') {
            stopRecording();
            alert('Microphone access denied.');
        }
    };

    recognition.onend = () => {
        if (isRecording) {
            recognition.start();
        }
    };

    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                addTranscriptLine(transcript);
            }
        }
    };
}

function addTranscriptLine(text, timestamp = null) {
    const transcriptArea = document.querySelector('.transcript-area');
    if (transcriptArea) {
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'timestamp';
        if (timestamp !== null) {
            timestampDiv.textContent = formatTime(timestamp);
        } else {
            const seconds = window.app.recordingDuration;
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            timestampDiv.textContent = hours > 0 
                ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        
        const textDiv = document.createElement('div');
        textDiv.className = 'text';
        textDiv.textContent = text;
        
        transcriptArea.appendChild(timestampDiv);
        transcriptArea.appendChild(textDiv);
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    }
}

async function toggleRecording() {
    if (!recognition) {
        if (!await setupRecording()) return;
    }

    isRecording = !isRecording;
    const button = document.querySelector('.record-button');

    if (isRecording) {
        recognition.start();
        mediaRecorder.start();
        audioChunks = [];
        window.app.startRecording();
    } else {
        recognition.stop();
        mediaRecorder.stop();
        window.app.stopRecording();
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const transcriptText = Array.from(document.querySelectorAll('.text'))
                .map(el => el.textContent)
                .join(' ');
            
            try {
                const response = await fetch(`/recordings?transcript=${encodeURIComponent(transcriptText)}&duration=${window.app.recordingDuration}`, {
                    method: 'POST',
                    body: audioBlob,
                    headers: {
                        'Content-Type': 'audio/wav'
                    }
                });
                
                if (response.ok) {
                    window.location.href = '/';
                } else {
                    console.error('Failed to save recording');
                }
            } catch (error) {
                console.error('Error saving recording:', error);
            }
        };
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});
