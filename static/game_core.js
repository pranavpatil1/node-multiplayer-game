"use strict";

/*

// stores which keys are pressed (either WASD or arrow keys)
var movement = {
    up: false,
    down: false,
    left: false,
    right: false
}

document.addEventListener('keydown', function(event) {
    switch (event.keyCode) {
    case 37: // left arrow
    case 65: // A
        movement.left = true;
        break;
    case 38: // up arrow
    case 87: // W
        movement.up = true;
        break;
    case 39: // right arrow
    case 68: // D
        movement.right = true;
        break;
    case 40: // down arrow
    case 83: // S
        movement.down = true;
        break;
    }
  });
  document.addEventListener('keyup', function(event) {
    switch (event.keyCode) {
    case 37: // left arrow
    case 65: // A
        movement.left = false;
        break;
    case 38: // up arrow
    case 87: // W
        movement.up = false;
        break;
    case 39: // right arrow
    case 68: // D
        movement.right = false;
        break;
    case 40: // down arrow
    case 83: // S
        movement.down = false;
        break;
    }
  });

var mvmtToNum = function(movement) {
    return (movement.down * 8 + movement.up * 4 + movement.left * 2 + movement.right * 1);
}

var numToMvmt = function(num) {
    return {down: num & 8, up: num & 4, left: num & 2, right: num & 1}
}

var movementQueue = [];

/**
 * want an animation for jumping and falling (and landing?) and crouch
 */

var game_core = function(game_instance){
    //Store the instance, if any
    this.instance = game_instance;

    //Used in collision etc.
    this.world = {
        width : 720,
        height : 480
    };

    this.players = [];

    this.load_images();
    this.connect_to_server();
    window.requestAnimationFrame(this.browser_update.bind(this));
    setInterval(this.short_update.bind(this), 15);
    this.socket.on('state', this.update_state.bind(this));

}; // game_core.constructor

game_core.prototype.update_state = function(gameState) {
    // take each of the dicts returned and do this
    for (var id in gameState.players) {
        if (this.players[id] === undefined) {
            this.players[id] = new client_player(gameState.players[id]);
        } else {
            this.players[id].update_vals(gameState.players[id]);
        }
    }
    this.blocks = gameState.blocks;
};

game_core.prototype.setup_keybinds = function() {

};

game_core.prototype.browser_update = function() {

    this.ctx.clearRect(0, 0, this.world.width, this.world.height);

    // updates the width of the canvas to match the window size (every frame)
    this.viewport.width = window.innerWidth;
    this.viewport.height = window.innerHeight;
    
    // blue sky background
    this.ctx.fillStyle = 'rgb(125,200,225)';
    this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    this.ctx.fillStyle = 'black';
    console.log(this.players);
    for (var id in this.players) {
        // id is the server socket id, index of dictionary
        var player = this.players[id];
        player.draw(this, this.ctx);
    }

    // assumes a constant y value for now, places a 10px rectangle for blocks
    this.ctx.fillStyle = 'black';
    for (var id in this.blocks) {
        var block = this.blocks[id];
        this.ctx.fillRect(block.x1, block.y1, block.x2-block.x1, block.y2-block.y1 + 10);
    }
    requestAnimationFrame(this.browser_update.bind(this));
};

game_core.prototype.short_update = function() {
    if (document.hasFocus()) {
        // this.socket.emit('movement', {});
    }
};

game_core.prototype.connect_to_server = function() {
    this.socket = io();
    this.socket.emit('new player');
};

game_core.prototype.load_images = function() {
    this.images = {};
    this.images.stand = new Image();
    this.images.stand.src = '/static/stickman_stand.png';
    this.images.walk = new Image();
    this.images.walk.src = '/static/stickman_walk.png';
};


var client_player = function () {
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
    this.facingRight = true; // to maintain graphics for xvel = 0
    this.lastTime = Date.now(); // used to calc deltaTime
    this.startTime = Date.now(); // used for animations (so not all synced up)
    if (arguments.length > 0) {
        this.update_vals(arguments[0]);
    }
}

client_player.prototype.draw = function(game_core, context) {
    // walking if moving fast enough
    var walking = true;
    if (Math.abs(this.vel.x) < 50) {
        walking = false;
    }

    // determine which spritesheet to use and whether to transform (for flipping image left/right)
    if (walking) {
        var state = 2 + Math.abs(Math.floor((Date.now() - this.startTime)/100) % 4);// -2 -1 0 1 2 3
        if (this.facingRight) {
            context.resetTransform();
            context.drawImage(game_core.images.walk, state * 40, 0, 40, 80, this.pos.x - 20, this.pos.y - 40, 40, 80);
        } else {
            context.resetTransform();
            context.scale(-1, 1);
            context.drawImage(game_core.images.walk, state * 40, 0, 40, 80, -(this.pos.x - 20) - 40, this.pos.y - 40, 40, 80);
            context.resetTransform();
        }
    } else {
        var state = Math.abs(Math.floor((Date.now() - this.startTime)/200) % 4 - 1);// -2 -1 0 1 2 3
        if (this.facingRight) {
            context.drawImage(game_core.images.stand, state * 40, 0, 40, 80, this.pos.x - 20, this.pos.y - 40, 40, 80);
        } else {
            context.resetTransform();
            context.scale(-1, 1);
            context.drawImage(game_core.images.stand, state * 40, 0, 40, 80, -(this.pos.x - 20) - 40, this.pos.y - 40, 40, 80);
            context.resetTransform();
        }
    }
}

client_player.prototype.update_vals = function(player) {
    this.pos = player.pos;
    this.vel = player.vel;
    this.jumping = player.jumping;
    this.lastTime = player.lastTime;
    this.startTime = player.startTime;
};

//server side we set the 'game_core' class to a global type, so that it can use it anywhere.
if( 'undefined' != typeof global ) {
    global.game_core = game_core;
    global.client_player = client_player;
    module.exports = {
        game_core,
        client_player
    };
}