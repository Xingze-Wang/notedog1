window.app = {
    config: {},
    startTime: null,
    recordingDuration: 0,
    
    async initializeCommon() {
        try {
            await this.loadConfig();
            this.updateTime();
            this.updateBattery();
            this.updateCreatedTime();
            setInterval(() => this.updateTime(), 1000);
            setInterval(() => this.updateBattery(), 30000);
            console.log('Common initialization complete');
        } catch (error) {
            console.error('Error in common initialization:', error);
        }
    },

    async loadConfig() {
        try {
            const response = await fetch('/config');
            if (!response.ok) {
                throw new Error(`Config load failed: ${response.status}`);
            }
            const config = await response.json();
            this.config = config;
            console.log('Configuration loaded');
        } catch (error) {
            console.error('Error loading config:', error);
            throw error;
        }
    },

    updateTime() {
        const now = new Date();
        const timeElement = document.getElementById('time');
        if (timeElement) {
            timeElement.textContent = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
        }
    },

    async updateBattery() {
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            const batteryElement = document.getElementById('battery');
            if (batteryElement) {
                batteryElement.textContent = `${Math.round(battery.level * 100)}%`;
            }
        }
    },

    updateCreatedTime() {
        const createdTimeElement = document.getElementById('created-time');
        if (createdTimeElement) {
            const now = new Date();
            createdTimeElement.textContent = now.toLocaleString('en-US', {
                weekday: 'short',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
    },

    startRecording() {
        this.startTime = new Date();
        this.updateDuration();
        this.durationInterval = setInterval(() => this.updateDuration(), 1000);
    },

    stopRecording() {
        if (this.durationInterval) {
            clearInterval(this.durationInterval);
        }
        this.startTime = null;
    },

    updateDuration() {
        if (!this.startTime) return;
        
        const now = new Date();
        const duration = Math.floor((now - this.startTime) / 1000);
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = duration % 60;
        
        const durationElement = document.getElementById('duration');
        if (durationElement) {
            durationElement.textContent = hours > 0 
                ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                : `${minutes}:${String(seconds).padStart(2, '0')}`;
        }
        this.recordingDuration = duration;
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.app.initializeCommon();
});
