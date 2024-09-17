console.log("hey myserver is starting with command line arguments:");
process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});
// if (process.argv.length < 4){
//     console.log("usage: node myserver portnum mode (production or dev)");
//     process.exit(1);
// }

var k_portnum=process.argv[2] || 7776;

//****************************************************************************

var express = require("express")
, app = express()
, server = require('http').createServer(app)
, WebSocketServer = require('ws').Server
, wss = new WebSocketServer({server: server})
, fs = require('fs');

console.log('so far so good !!!!!!!!!!!!!!!!');

//-------------------------------------------------------------

var m_useRoot="/www";

const allowedOrigins = ['https://aisound.sonicthings.org', 'https://claudio.sonicthings.org']; // Add your allowed origins here
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


app.use(express.static(__dirname + m_useRoot));

server.listen(process.argv[2] || k_portnum);
console.log("Connected and listening on port " + k_portnum);

wss.on('connection', function (ws) {
    ws.id = id++;
    console.log("got a connection, assigning ID = " + ws.id);

    ws.on('close', function() {        
        console.log(ws.id + " is gone..." );
    });
});


exports.server = server;

