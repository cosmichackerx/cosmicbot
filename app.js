const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }), // Silent logging to avoid noise
    printQRInTerminal: false, // We'll use pairing code instead
    auth: state,
    syncFullHistory: false,
  });

  // Handle pairing code for initial link
  if (!sock.authState.creds.registered) {
    const phoneNumber = 'YOUR_PHONE_NUMBER_HERE'; // Replace with your WhatsApp number in international format, e.g., '15551234567' (no +, no spaces)
    const pairingCode = await sock.requestPairingCode(phoneNumber);
    console.log(`Pairing code: ${pairingCode}`);
    // Instruct user to go to WhatsApp > Linked Devices > Link with phone number > Enter code
  }

  // Set presence to always available (online)
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      await sock.sendPresenceUpdate('available');
      console.log('Bot is online and appearing as available.');
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed:', lastDisconnect?.error);
      if (shouldReconnect) {
        await delay(5000); // Wait 5 seconds before reconnect
        startBot();
      } else {
        console.log('Logged out. Re-link the device.');
        process.exit(1);
      }
    }
  });

  // Save credentials on update
  sock.ev.on('creds.update', saveCreds);

  // Basic message handler (example: log incoming messages)
  sock.ev.on('messages.upsert', (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe) {
      console.log(`Received message from ${msg.key.remoteJid}: ${msg.message?.conversation}`);
      // Add your bot logic here, e.g., sock.sendMessage(msg.key.remoteJid, { text: 'Hello!' });
    }
  });

  return sock;
}

startBot().catch(console.error);
