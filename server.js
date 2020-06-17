var core = require('./server_core.js');

// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);

var port = 5000;

app.set('port', port);
app.use('/static', express.static(__dirname + '/static'));

// Routing
app.get('/', function(request, response) {
    response.sendFile(path.join(__dirname, 'index.html'));
});

// Starts the server.
server.listen(port, function() {
    console.log('Starting server on port ' + port);
});

var game = new server_core(game, io);

// maintains the current set of socket connections
io.on('connection', function(socket) {
  socket.on('disconnect', function() {
    game.on_disconnect(socket);
    console.log("Player gone", socket.id);
  });
  // client requested a new player
  socket.on('new player', function() {
    game.on_player_req(socket);
    console.log("Player joined", socket.id);
  });

  socket.on('movement', function(data) {
    game.on_input_received(data, socket);
  });
});

setInterval(function() {
    io.sockets.emit('state', game.publicState);
}.bind(this), 200);