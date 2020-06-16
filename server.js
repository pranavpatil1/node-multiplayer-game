// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);

app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));

// Routing
app.get('/', function(request, response) {
    response.sendFile(path.join(__dirname, 'index.html'));
  });

// Starts the server.
server.listen(5000, function() {
    console.log('Starting server on port 5000');
  });

// Add the WebSocket handlers
io.on('connection', function(socket) {
});

var core = require('./server_core.js');

// holds the players and blocks. this will be sent to all clients, more limited
const publicState = {
    players: {},
    blocks: [
        {x1:0, y1:500, x2:600, y2:500},
        {x1:300, y1:250, x2:600, y2:250}
    ]
}

// may contain data like entire objects/functions/data not sent to client
const serverState = {
    players: {},
}

var game = new server_core(game);

// maintains the current set of socket connections
io.on('connection', function(socket) {
  socket.on('disconnect', function() {
    delete serverState.players[socket.id];
    delete publicState.players[socket.id];
    console.log("Player gone", socket.id);
  });
  // client requested a new player
  socket.on('new player', function() {
    serverState.players[socket.id] = new server_player();
    publicState.players[socket.id] = serverState.players[socket.id].get_vals();
    console.log("Player joined", socket.id);
  });

  socket.on('movement', function(data) {
    var player = serverState.players[socket.id] || {};
    if (player.collision == undefined) {
      return; // early exit, no player OOF
    }
    var speed = 200;

    // no input or both (cancel out)
    if (!(data.left ^ data.right)) {
      player.vel.x = 0; // do nothing
    } else if (data.left) { // only one of them! set velocity
      player.vel.x = -speed;
      player.facingRight = false;
    } else if (data.right) {
      player.vel.x = speed;
      player.facingRight = true;
    }
    
    // on the ground. can initiate jump
    if (player.collision.down) {
      if (data.up) {
        player.vel.y = -speed * 4;
        player.jumping = true;
        player.collision.down = false;
      }
    }
    publicState.players[socket.id] = serverState.players[socket.id].get_vals();
  });
});

/**
 * 60 FPS update of game state. does physics/collision
 */
setInterval(function() {
    for (var i in serverState.players) {
        var player = serverState.players[i];
        var deltaTime = (Date.now() - player.lastTime)/1000;

        // gravity
        if (!player.collision.down) {
          player.vel.y += 20;
        }

        // assume no collisions unless found later
        player.collision.down = false;

        // collision detection with blocks

        // needs to be falling (no upward, head-hitting collision)
        if (player.vel.y >= 0) {
            for (var j in serverState.blocks) {
                var block = serverState.blocks[j];
                // if the bottom of the player is passing the block in this frame
                if ((player.pos.y + 40 <= block.y1) && (player.pos.y + 40 + player.vel.y * deltaTime >= block.y1) &&
                        (player.pos.x + 11 > block.x1 && player.pos.x - 9 < block.x2)) {
                    player.collision.down = true;
                    player.vel.y = 0;
                    player.jumping = false;
                    player.pos.y = block.y1 - player.vel.y * deltaTime - 40;
                }
            }
        }

        player.pos.y += player.vel.y * deltaTime;
        player.pos.x += player.vel.x * deltaTime;

        player.lastTime = Date.now();
    }
  }, 1000 / 60);


  setInterval(function() {
    io.sockets.emit('state', publicState);
  }, 20);