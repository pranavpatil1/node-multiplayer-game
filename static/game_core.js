"use strict";

var socket = io();
socket.on('message', function(data) {
  console.log(data);
});

var frame_time = 60/1000; // run the local game at 16ms/ 60hz
if('undefined' != typeof(global)) frame_time = 45; //on server we run at 45ms, 22hz

// setup RequestAnimationFrame
// https://github.com/ruby0x1/realtime-multiplayer-in-html5/blob/00af50dd57baa29f30809925881a624bc50234f1/game.core.js

( function () {

    var lastTime = 0;
    var vendors = [ 'ms', 'moz', 'webkit', 'o' ];

    for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++ x ) {
        window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
        window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
    }

    if ( !window.requestAnimationFrame ) {
        window.requestAnimationFrame = function ( callback, element ) {
            var currTime = Date.now(), timeToCall = Math.max( 0, frame_time - ( currTime - lastTime ) );
            var id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if ( !window.cancelAnimationFrame ) {
        window.cancelAnimationFrame = function ( id ) { clearTimeout( id ); };
    }

}() );

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

var mvmtToNum = function() {
    return (movement.down * 8 + movement.up * 4 + movement.left * 2 + movement.right * 1);
}

var movementQueue = [];

var canvas = document.getElementById('canvas');
var context = canvas.getContext('2d');

// tell the server to make a new player
socket.emit('new player');

var update = function(t) {
    
    //Work out the delta time
this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016;

    //Store the last frame time
this.lastframetime = t;

    //Update the game specifics
if(!this.server) {
    this.client_update();
} else {
    this.server_update();
}

    //schedule the next update
this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );

}; //game_core.update

setInterval(function() {
    if (document.hasFocus()) {
        socket.emit('movement', mvmtToNum());
        console.log(mvmtToNum())
    } else {
    }
}, 1000 / 60);

// loads player spritesheets
var standImg = new Image();   // Create new img element
standImg.src = '/static/stickman_stand.png'; // Set source path
var walkImg = new Image();   // Create new img element
walkImg.src = '/static/stickman_walk.png'; // Set source path

/**
 * want an animation for jumping and falling (and landing?) and crouch
 */

/**
 * on server update, what to do
 * 
 * naive implementation for now. FPS will be low due to latency
 */
socket.on('state', function(gameState) {
if (document.hasFocus()) {
    // updates the width of the canvas to match the window size (every frame)
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // blue sky background
    context.fillStyle = 'rgb(125,200,225)';
    context.fillRect(0, 0, window.innerWidth, window.innerHeight);

    for (var id in gameState.players) {
        // id is the server socket id, index of dictionary
        var player = gameState.players[id];
        // walking if moving fast enough
        var walking = true;
        if (Math.abs(player.xvel) < 50) {
          walking = false;
        }

        // determine which spritesheet to use and whether to transform (for flipping image left/right)
        if (walking) {
            var state = 2 + Math.abs(Math.floor((Date.now() - player.startTime)/100) % 4);// -2 -1 0 1 2 3
            if (player.facingRight) {
                context.resetTransform();
                context.drawImage(walkImg, state * 40, 0, 40, 80, player.x - 20, player.y - 40, 40, 80);
            } else {
                context.resetTransform();
                context.scale(-1, 1);
                context.drawImage(walkImg, state * 40, 0, 40, 80, -(player.x - 20) - 40, player.y - 40, 40, 80);
                context.resetTransform();
            }
        } else {
            var state = Math.abs(Math.floor((Date.now() - player.startTime)/200) % 4 - 1);// -2 -1 0 1 2 3
            if (player.facingRight) {
                context.drawImage(standImg, state * 40, 0, 40, 80, player.x - 20, player.y - 40, 40, 80);
            } else {
                context.resetTransform();
                context.scale(-1, 1);
                context.drawImage(standImg, state * 40, 0, 40, 80, -(player.x - 20) - 40, player.y - 40, 40, 80);
                context.resetTransform();
            }
        }
    
    }
    // assumes a constant y value for now, places a 10px rectangle for blocks
    context.fillStyle = 'black';
    for (var id in gameState.blocks) {
        var block = gameState.blocks[id];
        context.fillRect(block.x1, block.y1, block.x2-block.x1, block.y2-block.y1 + 10);
    }
} else {
    // whoops canvas is out of focus. display nothing. make it clear player is not on the canvas
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    context.fillStyle = 'rgb(62,100,112)';
    context.fillRect(0, 0, window.innerWidth, window.innerHeight);
}
});

var game_core = function(game_instance){

    //Store the instance, if any
this.instance = game_instance;
    //Store a flag if we are the server
this.server = this.instance !== undefined;

    //Used in collision etc.
this.world = {
    width : 720,
    height : 480
};

    //We create a player set, passing them
    //the game that is running them, as well
if(this.server) {

    this.players = {
        self : new game_player(this,this.instance.player_host),
        other : new game_player(this,this.instance.player_client)
    };

   this.players.self.pos = {x:20,y:20};

} else {

    this.players = {
        self : new game_player(this),
        other : new game_player(this)
    };

        //Debugging ghosts, to help visualise things
    this.ghosts = {
            //Our ghost position on the server
        server_pos_self : new game_player(this),
            //The other players server position as we receive it
        server_pos_other : new game_player(this),
            //The other players ghost destination position (the lerp)
        pos_other : new game_player(this)
    };

    this.ghosts.pos_other.state = 'dest_pos';

    this.ghosts.pos_other.info_color = 'rgba(255,255,255,0.1)';

    this.ghosts.server_pos_self.info_color = 'rgba(255,255,255,0.2)';
    this.ghosts.server_pos_other.info_color = 'rgba(255,255,255,0.2)';

    this.ghosts.server_pos_self.state = 'server_pos';
    this.ghosts.server_pos_other.state = 'server_pos';

    this.ghosts.server_pos_self.pos = { x:20, y:20 };
    this.ghosts.pos_other.pos = { x:500, y:200 };
    this.ghosts.server_pos_other.pos = { x:500, y:200 };
}

    //The speed at which the clients move.
this.playerspeed = 120;

    //Set up some physics integration values
this._pdt = 0.0001;                 //The physics update delta time
this._pdte = new Date().getTime();  //The physics update last delta time
    //A local timer for precision on server and client
this.local_time = 0.016;            //The local timer
this._dt = new Date().getTime();    //The local timer delta
this._dte = new Date().getTime();   //The local timer last frame time

    //Start a physics loop, this is separate to the rendering
    //as this happens at a fixed frequency
this.create_physics_simulation();

    //Start a fast paced timer for measuring time easier
this.create_timer();

    //Client specific initialisation
if(!this.server) {
    
        //Create a keyboard handler
    this.keyboard = new THREEx.KeyboardState();

        //Create the default configuration settings
    this.client_create_configuration();

        //A list of recent server updates we interpolate across
        //This is the buffer that is the driving factor for our networking
    this.server_updates = [];

        //Connect to the socket.io server!
    this.client_connect_to_server();

        //We start pinging the server to determine latency
    this.client_create_ping_timer();

        //Set their colors from the storage or locally
    this.color = localStorage.getItem('color') || '#cc8822' ;
    localStorage.setItem('color', this.color);
    this.players.self.color = this.color;

        //Make this only if requested
    if(String(window.location).indexOf('debug') != -1) {
        this.client_create_debug_gui();
    }

} else { //if !server

    this.server_time = 0;
    this.laststate = {};

}

}; //game_core.constructor


