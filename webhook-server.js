const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'change-me-to-secure-secret';

app.use(express.json());

function verifySignature(payload, signature) {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

app.post('/webhook/github', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);

  // Verify GitHub signature
  if (!verifySignature(payload, signature)) {
    console.log('Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  const event = req.headers['x-github-event'];

  // Only handle push events to main branch
  if (event === 'push' && req.body.ref === 'refs/heads/main') {
    console.log(`Push to main detected: ${req.body.head_commit.message}`);

    // Run update script
    exec('/root/js/state-forms/state-forms/auto-update-production.sh', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
    });

    res.status(200).send('Deployment triggered');
  } else {
    res.status(200).send('Event ignored');
  }
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
