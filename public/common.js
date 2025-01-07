window.app = {
    config: {},
    startTime: null,
    recordingDuration: 0,
    batteryManager: null,
    
    getApiUrl() {
        // Always use HTTPS
        return window.location.hostname === 'localhost' ? 'https://localhost:3000' : '';
    },
    
    async initializeCommon() {
        try {
            // Initialize time first (don't wait for config)
            this.updateTime();
            setInterval(() => this.updateTime(), 1000);
            
            // Initialize battery (don't wait for config)
            await this.initializeBattery();
            
            // Load config last (non-critical)
            try {
                await this.loadConfig();
            } catch (error) {
                console.warn('Config load failed, continuing with defaults:', error);
            }
            
            this.updateCreatedTime();
            console.log('Common initialization complete');
        } catch (error) {
            console.error('Error in common initialization:', error);
        }
    },

    async loadConfig() {
        try {
            const response = await fetch(`${this.getApiUrl()}/config`);
            if (!response.ok) {
                throw new Error(`Config load failed: ${response.status}`);
            }
            const config = await response.json();
            this.config = config;
            console.log('Configuration loaded');
        } catch (error) {
            console.error('Error loading config:', error);
            // Use defaults instead
            this.config = {
                maxRecordingDuration: 300,
                maxFileSize: '50mb',
                supportedFormats: ['audio/wav'],
                env: 'production'
            };
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
        const createdTimeElement = document.getElementById('created-time');
        if (createdTimeElement) {
            const now = new Date();
            createdTimeElement.textContent = now.toLocaleString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
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
