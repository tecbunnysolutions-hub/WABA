require('dotenv').config();
const { sendWhatsAppMessage } = require('./src/services/infobipService');

async function testOutbound() {
  console.log('Sending message...');
  const res = await sendWhatsAppMessage('919604136010', 'Test outbound from script');
  console.log(JSON.stringify(res, null, 2));
}

testOutbound();
