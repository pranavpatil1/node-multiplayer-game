"use strict";


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

    this.client;

    this.movementQueue = [];
    this.movementNum = 0;

    // stores which keys are pressed (either WASD or arrow keys)
    this.movement = {
        up: false,
        down: false,
        left: false,
        right: false
    }
    
    this.load_images();
    this.setup_keybinds();
    this.connect_to_server();
    window.requestAnimationFrame(this.browser_update.bind(this));
    setInterval(this.short_update.bind(this), 500);
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

    if (this.movementQueue.length > 0 && gameState.players[this.socket.id] !== undefined && 
            gameState.players[this.socket.id].lastNum !== -1) {
        var first = this.movementQueue[0].num;
        this.movementQueue.splice(0, gameState.players[this.socket.id].lastNum - first + 1);
        // console.log("START:", first);
        // console.log("NEW:", (this.movementQueue[0] || {}).num);
    }
    // console.log('update state');
};

game_core.prototype.setup_keybinds = function() {
    document.addEventListener('keydown', function(event) {
        switch (event.keyCode) {
        case 37: // left arrow
        case 65: // A
            this.movement.left = true;
            break;
        case 38: // up arrow
        case 87: // W
            this.movement.up = true;
            break;
        case 39: // right arrow
        case 68: // D
            this.movement.right = true;
            break;
        case 40: // down arrow
        case 83: // S
            this.movement.down = true;
            break;
        }
    }.bind(this));
    document.addEventListener('keyup', function(event) {
        switch (event.keyCode) {
        case 37: // left arrow
        case 65: // A
            this.movement.left = false;
            break;
        case 38: // up arrow
        case 87: // W
            this.movement.up = false;
            break;
        case 39: // right arrow
        case 68: // D
            this.movement.right = false;
            break;
        case 40: // down arrow
        case 83: // S
            this.movement.down = false;
            break;
        }
    }.bind(this));

};

/**
 * playing with static methods, representing dictionary with 4 booleans as binary bits in number
 * note: has no practical advantage as data is sent as a string, done for fun
 */
game_core.mvmt_to_num = function (movement) {
    return (movement.down * 8 + movement.up * 4 + movement.left * 2 + movement.right * 1);
}

/**
 * playing with static methods, converting number (4 binary bits) to 4 booleans in dictionary
 * note: has no practical advantage as data is sent as a string, done for fun
 */
game_core.num_to_mvmt = function (num) {
    return {down: num & 8, up: num & 4, left: num & 2, right: num & 1}
}

game_core.prototype.browser_update = function() {
    this.movementQueue.push(
        {
            num: this.movementNum,
            t: Date.now(),
            mvmt: game_core.mvmt_to_num(this.movement)
        }
    );
    this.movementNum ++;

    this.simulate_physics();
    this.draw_world();
    requestAnimationFrame(this.browser_update.bind(this));
};

game_core.prototype.simulate_physics = function() {
    if (this.client == undefined) return;
    if (this.players[this.socket.id] == undefined) return;
    if (this.movementQueue.length == 0) return;

    var player = this.client;
    player.update_vals(this.players[this.socket.id]);

    var speed = 200;

    var lastNum = player.lastNum;

    // console.log(this.movementQueue[this.movementQueue.length - 1].t);

    for (var j in this.movementQueue) {
        var movement = this.movementQueue[j];
        var data = game_core.num_to_mvmt(movement.mvmt);

        // convert movement request into player action (jump, move left/right if allowed)
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

        var deltaTime = (movement.t - player.lastTime)/1000;

        // gravity
        if (!player.collision.down) {
            player.vel.y += 1200 * deltaTime;
        }

        // assume no collisions unless found later
        player.collision.down = false;

        // collision detection with blocks

        // needs to be falling (no upward, head-hitting collision)
        if (player.vel.y >= 0) {
            for (var j in this.blocks) {
                var block = this.blocks[j];
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

        player.lastTime = movement.t;
    }
};

game_core.prototype.short_update = function() {
    if (document.hasFocus()) {
        this.socket.emit('movement', this.movementQueue);
    }
};

game_core.prototype.draw_world = function () {
    this.ctx.clearRect(0, 0, this.world.width, this.world.height);

    // updates the width of the canvas to match the window size (every frame)
    this.viewport.width = window.innerWidth;
    this.viewport.height = window.innerHeight;
    
    // blue sky background
    this.ctx.fillStyle = 'rgb(125,200,225)';
    this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    for (var id in this.players) {
        var player = this.players[id];
        if (id == this.socket.id) {
            this.client.draw(this, this.ctx);
        }
           player.draw(this, this.ctx);
        
    }

    // assumes a constant y value for now, places a 10px tall rectangle for blocks
    this.ctx.fillStyle = 'black';
    for (var id in this.blocks) {
        var block = this.blocks[id];
        this.ctx.fillRect(block.x1, block.y1, block.x2-block.x1, block.y2-block.y1 + 10);
    }
};

game_core.prototype.connect_to_server = function() {
    this.socket = io();
    this.socket.emit('new player');
    this.client = new client_player();
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
    this.walking = true;
    
    if (arguments.length > 0) {
        this.update_vals(arguments[0]);
    }
}

client_player.prototype.draw = function(game_core, context) {
    // walking if moving fast enough
    this.walking = true;
    if (Math.abs(this.vel.x) < 50) {
        this.walking = false;
    }

    // don't change anything if no x velocity
    if (this.vel.x > 0) {
        this.facingRight = true;
    }
    if (this.vel.x < 0) {
        this.facingRight = false;
    }

    // determine which spritesheet to use and whether to transform (for flipping image left/right)
    if (this.walking) {
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
    this.pos = {
        x: player.pos.x,
        y: player.pos.y
    };
    this.vel = {
        x: player.vel.x,
        y: player.vel.y
    };
    this.jumping = player.jumping;
    this.collision = {
        up: player.collision.up,
        down: player.collision.down,
        left: player.collision.left,
        right: player.collision.right
    };
    this.lastTime = player.lastTime;
    this.lastNum = player.lastNum;
    this.startTime = player.startTime;
};