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

// holds the players and blocks. this will be sent to all clients
const gameState = {
    players: {},
    blocks: [
        {x1:0, y1:500, x2:600, y2:500},
        {x1:300, y1:250, x2:600, y2:250}
    ]
}

// maintains the current set of socket connections
io.on('connection', function(socket) {
  socket.on('disconnect', function() {
    delete gameState.players[socket.id];
    console.log("Player gone", Date.now() % 1000000);
  });
  // client requested a new player
  socket.on('new player', function() {
    gameState.players[socket.id] = {
      x: 300,
      y: 300,
      xvel: 0.0,
      yvel: 0.0,
      jumping: true, // if jump initiated (not falling)
      collision: {
        left: false,
        right: false,
        up: false,
        down: false  // if player is colliding with blocks. for now only down used
      },
      facingRight: true, // to maintain position for xvel = 0
      lastTime: Date.now(), // used to calc deltaTime
      startTime: Date.now() // used for animations (so not all synced up)
    };
    console.log("Player joined", Date.now() % 1000000);
  });

  socket.on('movement', function(data) {
    var player = gameState.players[socket.id] || {};
    if (player.collision == undefined) {
      return; // early exit, no player OOF
    }
    var speed = 200;

    // no input or both (cancel out)
    if (!(data.left ^ data.right)) {
      player.xvel = 0; // do nothing
    } else if (data.left) { // only one of them! set velocity
      player.xvel = -speed;
      player.facingRight = false;
    } else if (data.right) {
      player.xvel = speed;
      player.facingRight = true;
    }
    
    // on the ground. can initiate jump
    if (player.collision.down) {
      if (data.up) {
        player.yvel = -speed * 4;
        player.jumping = true;
        player.collision.down = false;
      }
    }
  });
});

/**
 * 60 FPS update of game state. does physics/collision
 */
setInterval(function() {
    for (var i in gameState.players) {
        var player = gameState.players[i];
        var deltaTime = (Date.now() - player.lastTime)/1000;

        // gravity
        if (!player.collision.down) {
          player.yvel += 20;
        }

        // assume no collisions unless found later
        player.collision.down = false;

        // collision detection with blocks

        // needs to be falling (no upward, head-hitting collision)
        if (player.yvel >= 0) {
            for (var j in gameState.blocks) {
                var block = gameState.blocks[j];
                // if the bottom of the player is passing the block in this frame
                if ((player.y + 40 <= block.y1) && (player.y + 40 + player.yvel * deltaTime >= block.y1) &&
                        (player.x + 11 > block.x1 && player.x - 9 < block.x2)) {
                    player.collision.down = true;
                    player.yvel = 0;
                    player.jumping = false;
                    player.y = block.y1 - player.yvel * deltaTime - 40;
                }
            }
        }

        player.y += player.yvel * deltaTime;
        player.x += player.xvel * deltaTime;

        player.lastTime = Date.now();
    }
    io.sockets.emit('state', gameState);
  }, 1000 / 60);
