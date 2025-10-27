import app from './app.js';
import logger from './logger.js';

app.listen(process.env.PORT || 3001,'0.0.0.0',(err) => {
    if (err) {
        logger.error('Error starting the server:', err.message);
        return;
    }
    logger.info(`User Management Service is running on port http://localhost:${process.env.PORT || 3001}/api/auth`);
});