const { Kafka } = require('kafkajs');
const { isEmpty } = require('lodash');
const { sendEmail, handleDataSuccess, handleDataFail } = require('./handle-send-mail');

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: [...getKBroker()]
});

function getKBroker() {
  return ['localhost:9092'];
}

module.exports = async function () {
  try {
    const consumer = kafka.consumer({ groupId: 'group-mailer-service' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'send-email' });
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const content = JSON.parse(message.value.toString());
        if (isEmpty(content.email)) {
          console.log('Error format data mail!')
          return;
        }
        try {
          const res = await sendEmail({
            email: content.email,
            subject: content.subject,
            template: content.template,
            sender: content.sender && content.sender,
            bcc: content.bcc && content.bcc,
            cc: content.cc && content.cc,
            attachment: content.attachment && content.attachment,
            messageId: content.messageId && content.messageId
          }, (err, result) => {
            if (err) {
              console.log("TCL: err", err)
            }
            console.log(result);
          });

          await handleDataSuccess({ ...content, messageId: res.messageId });
        } catch (error) {
          await handleDataFail(content);
          console.log('eachMessage-error', error);
        }
      }
    });

    const errorTypes = ['unhandledRejection', 'uncaughtException'];
    const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    errorTypes.map((type) => {
      process.on(type, async (e) => {
        try {
          console.log(`process.on ${type}`);
          console.error(e);
          await consumer.disconnect();
          process.exit(0);
        } catch (_) {
          process.exit(1);
        }
      });
    });

    signalTraps.map((type) => {
      process.once(type, async () => {
        try {
          await consumer.disconnect();
        } finally {
          process.kill(process.pid, type);
        }
      });
    });
  } catch (e) {
    console.error(`[example/consumer] ${e.message}`, e);
  }
};

