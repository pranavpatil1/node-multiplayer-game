"use strict";

var socket = io();
socket.on('message', function(data) {
  console.log(data);
});

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

document.getElementById("canvas").addEventListener('onblur', function (event) {
    console.log("Lost focus");
    
    movement.down = false;
    movement.up = false;
    movement.left = false;
    movement.right = false;
});
document.getElementById("canvas").addEventListener('onfocus', function (event) {
    console.log("Gained focus");
});

var canvas = document.getElementById('canvas');
var context = canvas.getContext('2d');
socket.emit('new player');
setInterval(function() {
    if (document.hasFocus()) {
        socket.emit('movement', movement);
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
 */
socket.on('state', function(gameState) {
if (document.hasFocus()) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    context.fillStyle = 'rgb(125,200,225)';
    context.fillRect(0, 0, window.innerWidth, window.innerHeight);
    context.fillStyle = 'white';
    for (var id in gameState.players) {
        var player = gameState.players[id];
        var walking = true;
        if (Math.abs(player.xvel) < 50) {
          walking = false;
        }

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
    context.fillStyle = 'black';
    for (var id in gameState.blocks) {
        var block = gameState.blocks[id];
        context.fillRect(block.x1, block.y1, block.x2-block.x1, block.y2-block.y1 + 10);
    }
} else {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    context.fillStyle = 'rgb(62,100,112)';
    context.fillRect(0, 0, window.innerWidth, window.innerHeight);
}
});