import { connectRabbitMQ } from '../config/rabbitmq.js';
import sendEmail from '../emailservice/email.js';
import logger from '../logger.js';

const QUEUE_NAME = 'email_verification';

export const startConsumer = async () => {
  logger.info('Starting consumer...');
  const channel = await connectRabbitMQ();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  logger.info(`Consumer listening on queue: ${QUEUE_NAME}`);

  channel.consume(QUEUE_NAME, async (msg) => {
    logger.info('Message received:', msg ? msg.content.toString() : 'null');
    if (msg) {
      const { email, token } = JSON.parse(msg.content.toString());
      try {
        logger.info('Sending email to:', email, 'with token:', token);
        await sendEmail(email, token);
        channel.ack(msg);
      } catch (err) {
        logger.error('Email send failed, requeueing:', err.message);
        channel.nack(msg, false, true);
      }
    }
  });
};

// Make sure to call startConsumer if this is your entry file:


