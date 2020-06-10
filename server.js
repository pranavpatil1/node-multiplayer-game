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

const gameState = {
    players: {},
    blocks: [
      {x1:0, y1:500, x2:600, y2:500},
      {x1:300, y1:250, x2:600, y2:250}
    ]
}


var lastUpdate = Date.now(); // when the last update was received
var prevUpdate = 0; // when the players were last all updated

io.on('connection', function(socket) {
  socket.on('disconnect', function() {
    delete gameState.players[socket.id];
    console.log("Player gone", Date.now() % 1000000);
  });
  socket.on('new player', function() {
    gameState.players[socket.id] = {
      x: 300,
      y: 300,
      xvel: 0.0,
      yvel: 0.0,
      jumping: true,
      collision: {
        left: false,
        right: false,
        up: false,
        down: false
      },
      facingRight: true,
      lastTime: Date.now(),
      startTime: Date.now()
    };
    lastUpdate = Date.now();
    console.log("Player joined", Date.now() % 1000000);
  });
  /**
   * ERROR: ONLY MAKES UPDATE ON A SCREEN WHEN A MOVEMENT OCCURS
   */
  socket.on('movement', function(data) {
    var speed = 200;
    var player = gameState.players[socket.id] || {};
    if (player.collision == undefined) {
      return; // early exit, no player OOF
    }
    if (!(data.left ^ data.right)) {
      player.xvel = 0;
    } else if (data.left) {
      player.xvel = -speed;
      player.facingRight = false;
    } else if (data.right) {
      player.xvel = speed;
      player.facingRight = true;
    }
    
    if (player.collision.down) {
      if (data.up) {
        player.yvel = -speed * 4;
        player.jumping = true;
        player.collision.down = false;
      }
    } else if (data.down) {
      player.yvel = 0;
      player.jumping = false;
      player.collision.down = true;
    }
    // if actual non 0 movement happening
    if ((data.left ^ data.right) || (data.up ^ data.down))
        lastUpdate = Date.now();
  });
});

setInterval(function() {
    for (var i in gameState.players) {
        var player = gameState.players[i];
        var deltaTime = (Date.now() - player.lastTime)/1000;

        if (!player.collision.down) {
          player.yvel += 20;
        }

        player.collision.down = false;

        // collision detection with blocks
        if (player.yvel >= 0) {
          for (var j in gameState.blocks) {
            var block = gameState.blocks[j];
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
