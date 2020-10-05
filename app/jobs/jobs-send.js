const { Kafka } = require('kafkajs');
const { isEmpty } = require('lodash');
const {
  sendEmail,
  handleDataSuccess,
  handleDataFail,
  handleRequestSendUpdateFail
} = require('../service/handle-send-mail');

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
        // re-update fail
        if (isEmpty(content.email)) {
          console.log('Error format data mail!')
          return;
        }
        console.log('eachMessage', content);
        if (content.type === 'sync-mail' && content.service === 'CUSTOMER')
          handleRequestSendUpdateFail();
        try {
          const res = await sendEmail({
            email: content.email,
            subject: content.subject,
            template: content.template,
            sender: content.sender && content.sender,
            bcc: content.bcc && content.bcc,
            cc: content.cc && content.cc,
            attachment: content.attachment && content.attachment,
            messageId: content.messageId && content.messageId,
          }, (err, result) => {
            if (err) {
              console.log("TCL: err", err)
            }
            console.log(result);
          });

          if (content.type === 'sync-mail' && content.service === 'CUSTOMER')
            await handleDataSuccess({
              ...content,
              from: content.sender,
              parentId: content.messageId && content.messageId,
              messageId: res.messageId
            });
        } catch (error) {
          if (content.type === 'sync-mail' && content.service === 'CUSTOMER') await handleDataFail({ ...content, from: content.sender });
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

