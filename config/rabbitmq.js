import amqp from 'amqplib'
import logger from '../logger.js';
import dotenv from 'dotenv';
dotenv.config({ path: "../.env"});
let channel;
const connectRabbitMQ = async () => {
  if (channel) return channel; // reuse existing channel if already connected

  try {
    if (!process.env.RABBITMQ_URL) {
      throw new Error('RABBITMQ_URL is not set in environment variables');
    }

    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    logger.info('RabbitMQ connected successfully');

    // Handle connection close / errors
    connection.on('close', () => {
      logger.error('RabbitMQ connection closed!');
      channel = null;
    });

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
      channel = null;
    });

    return channel;
  } catch (error) {
    logger.error('Error connecting to RabbitMQ:', error.message);
    throw error;
  }
};

export { connectRabbitMQ, channel };