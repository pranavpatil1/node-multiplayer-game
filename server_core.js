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

}; // game_core.constructor

server_core.prototype.update_state = function(gameState) {
    this.players = gameState.players;
    this.blocks = gameState.blocks;
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