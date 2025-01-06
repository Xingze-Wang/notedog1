# ND1 - Audio Transcription Service

A production-ready audio transcription service built with Node.js, Express, and MongoDB.

## Features

- Real-time audio transcription
- MongoDB integration for data persistence
- Production-ready security features
- Rate limiting and request validation
- Comprehensive error handling and logging
- PM2 process management for scalability
- Health monitoring endpoints

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- PM2 (for production deployment)

## Installation

1. Clone the repository:
   ```bash
   git clone [your-repository-url]
   cd nd1
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Development

Run the application in development mode:
```bash
npm run dev
```

## Production Deployment

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start the application:
   ```bash
   npm run prod
   ```

3. Monitor the application:
   ```bash
   pm2 status
   pm2 logs
   ```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/recordings` - Get all recordings
- `POST /api/recordings` - Create new recording
- `GET /` - Main application interface
- `GET /transcript` - View transcripts

## Environment Variables

See `.env.example` for all required environment variables.

## Security Features

- Helmet.js for security headers
- Rate limiting
- CORS configuration
- Request validation
- Secure environment variable handling

## Monitoring

- Winston logging
- PM2 process management
- Health check endpoints
- Performance monitoring

## License

MIT

## Author

[Your Name]
