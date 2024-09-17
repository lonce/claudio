const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');


const app = express();

// Enable CORS for all routes
app.use(cors());

// Serve static files from the 'app' directory
app.use(express.static(path.join(__dirname, 'www')));

// Get port from command line arguments or use default 3000
const httpPort = process.argv[2] || 3000;
const httpsPort = parseInt(httpPort) + 443;

// SSL options
const sslOptions = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
};

// console.log(`sslOptions.key: ${sslOptions.key}, sslOptions.cert: ${sslOptions.cert}`)

// This is so that we can get resources (sound files) from the server.
// They are hard coded in the sound models, and don't use relative paths.
const allowedOrigins = ['https://192.168.1.135']; // Add your allowed origins here
app.use(function (req, res, next) {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin); // Allow only trusted origins
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"); // Specify allowed methods
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Authorization"); // Specify allowed headers
    res.header("Access-Control-Allow-Credentials", "true"); // Allow credentials if needed
  }
  console.log("Cross domain request to: " + req.url); // Reduce log verbosity if in production
  next();
});



// Create HTTP server
http.createServer(app).listen(httpPort, () => {
  console.log(`Claudio is serving your audio app over HTTP at http://localhost:${httpPort}`);
});

// Create HTTPS server
https.createServer(sslOptions, app).listen(httpsPort, () => {
  console.log(`Claudio is serving your audio app securely over HTTPS at https://localhost:${httpsPort}`);
});



console.log(`To access from other devices on your network, use your computer's IP address instead of localhost`);

// Handle 404 errors
app.use((req, res) => {
  res.status(404).send('404: Page not found');
});

// Handle other errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('500: Internal Server Error');
});
