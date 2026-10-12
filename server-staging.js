// Staging entrypoint: loads .env.staging (instead of .env) and starts the
// same Express app in staging mode.
require('dotenv').config({ path: '.env.staging' });
process.env.NODE_ENV = 'staging';
require('./server.js');
