// Index page specific functionality
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize common features
        await window.app.initializeCommon();
        
        // Initialize index-specific features
        await initializeIndex();
        await loadRecordings();
    } catch (error) {
        console.error('Error initializing index page:', error);
    }
});

async function initializeIndex() {
    try {
        await setupNoteCards();
        setupRecButton();
    } catch (error) {
        console.error('Error in index initialization:', error);
    }
}

async function setupNoteCards() {
    try {
        const noteCards = document.querySelectorAll('.note-card');
        noteCards.forEach(card => {
            card.addEventListener('click', () => {
                console.log('Note card clicked');
            });
        });
    } catch (error) {
        console.error('Error setting up note cards:', error);
    }
}

function setupRecButton() {
    try {
        const recButton = document.querySelector('.rec-button');
        if (recButton) {
            recButton.addEventListener('click', () => {
                window.location.href = '/transcript?mode=record';
                console.log('Recording button clicked');
            });
        }
    } catch (error) {
        console.error('Error setting up recording button:', error);
    }
}

async function loadRecordings() {
    try {
        const response = await fetch('/recordings');
        const recordings = await response.json();
        
        // Group recordings by date
        const groupedRecordings = {};
        recordings.forEach(recording => {
            const date = new Date(recording.timestamp);
            const dateKey = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            
            if (!groupedRecordings[dateKey]) {
                groupedRecordings[dateKey] = [];
            }
            groupedRecordings[dateKey].push(recording);
        });

        // Clear existing notes but keep the warning card
        const warningCard = document.querySelector('.warning-card');
        const container = warningCard.parentNode;
        const recordingsContainer = document.createElement('div');
        recordingsContainer.id = 'recordings-container';
        
        // Remove old recordings container if it exists
        const oldContainer = document.getElementById('recordings-container');
        if (oldContainer) {
            oldContainer.remove();
        }

        // Add recordings grouped by date
        Object.entries(groupedRecordings).forEach(([date, dayRecordings]) => {
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            dateHeader.textContent = date;
            recordingsContainer.appendChild(dateHeader);

            dayRecordings.forEach(recording => {
                const noteCard = document.createElement('a');
                noteCard.className = 'note-card';
                noteCard.href = `transcript.html?mode=playback&id=${recording.id}`;
                noteCard.innerHTML = `
                    <div class="note-meta">
                        ${new Date(recording.timestamp).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                        })} • ${recording.duration}s • Xingze Wang
                    </div>
                    <div class="note-content">
                        <strong>${recording.title || 'New Recording'}</strong><br>
                        ${recording.summary || recording.transcript}
                    </div>
                `;
                recordingsContainer.appendChild(noteCard);
            });
        });

        // Insert recordings container after warning card
        warningCard.parentNode.insertBefore(recordingsContainer, warningCard.nextSibling);
    } catch (error) {
        console.error('Error loading recordings:', error);
    }
}
