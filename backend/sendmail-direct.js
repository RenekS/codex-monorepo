// sendmail-local.js
console.log('🐢 Starting local send via sendmail transport');
const nodemailer = require('nodemailer');

async function sendLocal() {
  console.log('🔧 Creating sendmail transporter');
  let transporter = nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail',  // pokud jste na Linuxu; na Windows tenhle mód logicky nepojede
    logger: true,
    debug: true
  });

  console.log('📨 About to send local mail...');
  let info = await transporter.sendMail({
    from:    'brno_sklad@czstyle.cz',
    to:      'brno_sklad@czstyle.cz', // posíláme sám sobě
    subject: 'TEST LOKÁLNĚ',
    text:    'TEST NODE LOKÁLNĚ'
  });

  console.log('✅ Mail sent locally, MessageId:', info.messageId);
}

sendLocal().catch(err => {
  console.error('❌ Chyba při lokálním odeslání:', err);
  process.exit(1);
});
