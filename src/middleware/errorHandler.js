const createError = require('http-errors');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    logger.error({
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    if (err instanceof createError.HttpError) {
        res.status(err.status).json({
            error: err.message
        });
    } else {
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
};

module.exports = errorHandler;
