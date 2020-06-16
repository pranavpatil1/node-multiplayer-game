"use strict";

var server_core = function(game_instance){
    //Store the instance, if any
    this.instance = game_instance;

    //Used in collision etc.
    this.world = {
        width : 720,
        height : 480
    };

    this.players = [];
    
    // holds the players and blocks. this will be sent to all clients, more limited
    this.publicState = {
        players: {},
        blocks: [
            {x1:0, y1:500, x2:600, y2:500},
            {x1:300, y1:250, x2:600, y2:250}
        ]
    }

    // may contain data like entire objects/functions/data not sent to client
    this.serverState = {
        players: {},
        blocks: this.publicState.blocks
    }
    
    setInterval(this.physics_loops.bind(this), 1000 / 60);

}; // game_core.constructor

/**
 * 60 FPS update of game state. does physics/collision
 */
server_core.prototype.physics_loops = function () {
    for (var i in this.serverState.players) {
        var player = this.serverState.players[i];
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
            for (var j in this.serverState.blocks) {
                var block = this.serverState.blocks[j];
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
};

server_core.prototype.on_disconnect = function(socket) {
    delete this.serverState.players[socket.id];
    delete this.publicState.players[socket.id];
};

server_core.prototype.on_player_req = function(socket) {
    this.serverState.players[socket.id] = new server_player();
    this.publicState.players[socket.id] = this.serverState.players[socket.id].get_vals();
};

server_core.prototype.on_input_received = function(data, socket) {
    var player = this.serverState.players[socket.id] || {};
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
    this.publicState.players[socket.id] = this.serverState.players[socket.id].get_vals();
};


var server_player = function (character_instance) {
    this.instance = character_instance;

    this.pos = {
        x: 300,
        y: 300
    };
    this.vel = {
      x: 0.0,
      y: 0.0,
    };
    this.jumping = true; // if jump initiated (not falling)
    this.collision = {
        left: false,
        right: false,
        up: false,
        down: false  // if player is colliding with blocks. for now only down used
    };
    this.lastTime = Date.now(); // used to calc deltaTime
    this.startTime = Date.now(); // used for animations (so not all synced up)

}

server_player.prototype.get_vals = function(gameState) {
    return {
        pos: this.pos,
        vel: this.vel,
        jumping: this.jumping,
        lastTime: this.lastTime,
        startTime: this.startTime
    };
};

global.server_core = server_core;
global.server_player = server_player;
module.exports = {
    server_core,
    server_player
};