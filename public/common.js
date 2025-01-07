window.app = {
    config: {},
    startTime: null,
    recordingDuration: 0,
    batteryManager: null,
    
    async initializeCommon() {
        try {
            await this.loadConfig();
            await this.initializeBattery();
            this.updateTime();
            this.updateCreatedTime();
            
            // Update time every second
            setInterval(() => this.updateTime(), 1000);
            
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
                hour12: false,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            });
        }
    },

    async initializeBattery() {
        try {
            if ('getBattery' in navigator) {
                this.batteryManager = await navigator.getBattery();
                
                // Initial battery update
                this.updateBattery();

                // Add battery event listeners
                this.batteryManager.addEventListener('levelchange', () => this.updateBattery());
                this.batteryManager.addEventListener('chargingchange', () => this.updateBattery());
                
                console.log('Battery monitoring initialized');
            } else {
                console.log('Battery API not supported');
                const batteryElement = document.getElementById('battery');
                if (batteryElement) {
                    batteryElement.textContent = '100%';
                }
            }
        } catch (error) {
            console.error('Error initializing battery:', error);
            const batteryElement = document.getElementById('battery');
            if (batteryElement) {
                batteryElement.textContent = '100%';
            }
        }
    },

    updateBattery() {
        if (this.batteryManager) {
            const batteryElement = document.getElementById('battery');
            if (batteryElement) {
                const level = Math.round(this.batteryManager.level * 100);
                const charging = this.batteryManager.charging;
                batteryElement.textContent = `${level}%${charging ? ' ⚡' : ''}`;
            }
        }
    },

    updateCreatedTime() {
        const elements = document.querySelectorAll('.note-meta');
        elements.forEach(element => {
            const text = element.textContent;
            if (text.includes('•')) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                });
                element.textContent = text.replace(/\d{1,2}:\d{2} [AP]M/, timeStr);
            }
        });
    },

    startRecording() {
        this.startTime = new Date();
        this.recordingDuration = 0;
        this.updateDuration();
    },

    stopRecording() {
        this.startTime = null;
        return this.recordingDuration;
    },

    updateDuration() {
        if (this.startTime) {
            const now = new Date();
            this.recordingDuration = Math.floor((now - this.startTime) / 1000);
            
            const durationElement = document.getElementById('duration');
            if (durationElement) {
                const minutes = Math.floor(this.recordingDuration / 60);
                const seconds = this.recordingDuration % 60;
                durationElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }

            requestAnimationFrame(() => this.updateDuration());
        }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.app.initializeCommon();
});
