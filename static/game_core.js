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

    // representation of players received from server (stored as client_player objects)
    this.players = [];

    // client_player that uses client prediction
    this.client;

    // a queue of all movements yet to be handled by server. once server has handled movement, it is dequeued
    this.movementQueue = [];
    // number used to identify order of movements, which to remove
    this.movementNum = 0;

    // stores which keys are pressed
    this.movement = {
        up: false,
        down: false,
        left: false,
        right: false
    }
    
    // loads spritesheets
    this.load_images();

    // adds listeners on keyup and keydown
    this.setup_keybinds();

    // connects to server, requests new player
    this.connect_to_server();

    // fast browser update (faster than 60 fps???)
    window.requestAnimationFrame(this.browser_update.bind(this));

    // sending movementQueue to server (500ms wait to simulate network latency)
    setInterval(this.short_update.bind(this), 500);

    // on state received back, update players list, blocks, handle movement queue
    this.socket.on('state', this.update_state.bind(this));

}; // game_core.constructor

/**
 * handles data received from server. updates players list (creates new if needed)
 */
game_core.prototype.update_state = function(gameState) {
    var playersExist = {};
    // take each of the dicts returned and do this
    for (var id in gameState.players) {
        playersExist[id] = true;
        if (this.players[id] === undefined) {
            this.players[id] = new client_player(gameState.players[id]);
        } else {
            this.players[id].update_vals(gameState.players[id]);
        }
    }
    // checks if player is gone, then removes them from local list
    for (var id in this.players) {
        if (!playersExist[id])
            delete this.players[id];
    }
    // updates blocks (don't change now but may later)
    this.blocks = gameState.blocks;

    // removes any elements in movement queue that were already processed by server
    // -1 flag means no movements received, ever
    if (this.movementQueue.length > 0 && gameState.players[this.socket.id] !== undefined && 
            gameState.players[this.socket.id].lastNum !== -1) {
        var first = this.movementQueue[0].num;
        this.movementQueue.splice(0, gameState.players[this.socket.id].lastNum - first + 1);
    }
};

/**
 * adds listeners to key up and down to handle movement on both arrow keys and WASD
 */
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
    // adds movements. stores order, time, and number representing movement requested
    this.movementQueue.push(
        {
            num: this.movementNum,
            t: Date.now(),
            mvmt: game_core.mvmt_to_num(this.movement)
        }
    );
    this.movementNum ++;

    // client prediction
    this.simulate_physics();

    // draws everything
    this.draw_world();

    // loads function again (creates a loop)
    requestAnimationFrame(this.browser_update.bind(this));
};

game_core.prototype.update_player = function(player, movement) {
    var speed = 200;

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

game_core.prototype.update_other_player = function(player, movement) {
    var speed = 200;

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

    if (!player.lastUpdate) {
        player.lastUpdate = Date.now();
        return;
    }

    var deltaTime = (Date.now() - player.lastUpdate) / 1000;

    console.log(deltaTime)

    // gravity
    if (!player.collision.down) {
        player.vel.y += 1200 * deltaTime;
    }

    // assume no collisions unless found later
    player.collision.down = false;
    
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

    player.lastUpdate = Date.now();
}

/**
 * simulate_physics method has the same physics code as server but operates on movements
 * not handled by server yet. uses server's knowledge of player position as a baseline and moves
 * from there
 */
game_core.prototype.simulate_physics = function() {
    // need a player and movements to simulate
    if (this.client == undefined) return;
    if (this.players[this.socket.id] == undefined) return;
    if (this.movementQueue.length == 0) return;

    // set player to simulate to the client variable
    var player = this.client;
    // update values
    // (important: don't do it directly like this.client.update_vals or the definition of this gets confused)
    player.update_vals(this.players[this.socket.id]);

    // loops through all movements (queue only has ones not handled by server)
    for (var j in this.movementQueue) {
        var movement = this.movementQueue[j];
        this.update_player(player, movement);
    }

    for (const [id, otherPlayer] of Object.entries(this.players)) {
        if (id != this.socket.id) {
            var movement = otherPlayer.lastMovement;
            if (movement) {
                this.update_other_player(otherPlayer, movement);
            }
        }
      }
};

game_core.prototype.short_update = function() {
    if (document.hasFocus()) {
        this.socket.emit('movement', this.movementQueue);
    } else {
        // todo: need some pause functionality. server stops simulating player
        // should the player continue moving with last request if server lags more than 1 second or just stuck?
    }
};

/**
 * uses the context and draws all the blocks and players
 */
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
        } else {
            player.draw(this, this.ctx);
        }
    }

    // assumes a constant y value for now, places a 10px tall rectangle for blocks
    this.ctx.fillStyle = 'black';
    for (var id in this.blocks) {
        var block = this.blocks[id];
        this.ctx.fillRect(block.x1, block.y1, block.x2-block.x1, block.y2-block.y1 + 10);
    }
};

/**
 * request new player. est. socket connection. store local client for prediction
 */
game_core.prototype.connect_to_server = function() {
    this.socket = io();
    this.socket.emit('new player');
    this.client = new client_player();
};

/**
 * create dictionary of spritesheets
 */
game_core.prototype.load_images = function() {
    this.images = {};
    this.images.stand = new Image();
    this.images.stand.src = '/static/stickman_stand.png';
    this.images.walk = new Image();
    this.images.walk.src = '/static/stickman_walk.png';
};

/**
 * defines a client_player class that can handle player and draw player
 */
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

    this.lastMovement = null;
    this.lastUpdate = null;
    
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

    this.lastMovement = player.lastMovement;
    this.lastUpdate = Date.now();
};