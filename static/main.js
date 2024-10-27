var conn = new WebSocket("ws://" + document.location.host + "/ws");
var GameState;
(function (GameState) {
    GameState[GameState["INITIALIZING"] = 0] = "INITIALIZING";
    GameState[GameState["RUNNING"] = 1] = "RUNNING";
})(GameState || (GameState = {}));
var currentGameState = GameState.INITIALIZING;
var game = {
    localPlayerId: 0,
    localPlayerSize: 0,
    playerSpeed: 0,
    worldHeight: 0,
    worldWidth: 0,
    players: {},
};
function setPlayer(playerId, position) {
    game.players[playerId] = { position: position };
}
function deletePlayer(playerId) {
    delete game.players[playerId];
}
conn.onmessage = function (ev) {
    var message = JSON.parse(ev.data);
    switch (message.type) {
        case "init":
            var initData = message.data;
            game.localPlayerId = initData.player_id;
            game.localPlayerSize = initData.player_size;
            game.playerSpeed = initData.player_speed;
            game.worldWidth = initData.world_width;
            game.worldHeight = initData.world_height;
            game.players = initData.players;
            currentGameState = GameState.RUNNING;
            break;
        case "connect":
            var connectData = message.data;
            setPlayer(connectData.id, { x: connectData.position.x, y: connectData.position.y });
            break;
        case "disconnect":
            deletePlayer(message.data);
            break;
        case "pos_update":
            var posUpdateData = message.data;
            setPlayer(posUpdateData.id, { x: posUpdateData.position.x, y: posUpdateData.position.y });
            break;
    }
};
var canvas = document.getElementById("gameCanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var camera = {
    x: 0,
    y: 0,
};
var keysPressed = {};
var KEY_W = "w";
var KEY_A = "a";
var KEY_S = "s";
var KEY_D = "d";
var KEY_UP = "ArrowUp";
var KEY_DOWN = "ArrowDown";
var KEY_LEFT = "ArrowLeft";
var KEY_RIGHT = "ArrowRight";
addEventListener("keydown", function (ev) {
    keysPressed[ev.key] = true;
});
addEventListener("keyup", function (ev) {
    keysPressed[ev.key] = false;
});
function updatePlayerPosition() {
    var moveX = 0;
    var moveY = 0;
    if (keysPressed[KEY_W] || keysPressed[KEY_UP]) {
        if (game.players[game.localPlayerId].position.y > 0) {
            moveY = -1;
        }
    }
    if (keysPressed[KEY_S] || keysPressed[KEY_DOWN]) {
        if (game.players[game.localPlayerId].position.y <
            game.worldHeight - game.localPlayerSize) {
            moveY = 1;
        }
    }
    if (keysPressed[KEY_A] || keysPressed[KEY_LEFT]) {
        if (game.players[game.localPlayerId].position.x > 0) {
            moveX = -1;
        }
    }
    if (keysPressed[KEY_D] || keysPressed[KEY_RIGHT]) {
        if (game.players[game.localPlayerId].position.x <
            game.worldWidth - game.localPlayerSize) {
            moveX = 1;
        }
    }
    // Normalize the movement vector if both axes are pressed
    var length = Math.sqrt(moveX * moveX + moveY * moveY);
    if (length > 0) {
        moveX /= length;
        moveY /= length;
    }
    var newX = Math.min(Math.max(game.players[game.localPlayerId].position.x + moveX * game.playerSpeed, 0), game.worldWidth - game.localPlayerSize);
    var newY = Math.min(Math.max(game.players[game.localPlayerId].position.y + moveY * game.playerSpeed, 0), game.worldHeight - game.localPlayerSize);
    var msg = {
        type: "pos_update",
        data: {
            id: game.localPlayerId,
            position: {
                x: newX,
                y: newY
            }
        },
    };
    // Send player position if moved
    if (moveX !== 0 || moveY !== 0) {
        conn.send(JSON.stringify(msg));
    }
    // Update camera position to center on the player
    var halfCanvasWidth = canvas.width / 2;
    var halfCanvasHeight = canvas.height / 2;
    camera.x = Math.max(0, Math.min(game.players[game.localPlayerId].position.x -
        halfCanvasWidth +
        game.localPlayerSize / 2, game.worldWidth - canvas.width));
    camera.y = Math.max(0, Math.min(game.players[game.localPlayerId].position.y -
        halfCanvasHeight +
        game.localPlayerSize / 2, game.worldHeight - canvas.height));
}
var ctx = canvas.getContext("2d");
function render() {
    ctx.clearRect(0, 0, game.worldWidth, game.worldHeight);
    // Calculate camera offsets
    var offsetX = game.players[game.localPlayerId].position.x - camera.x;
    var offsetY = game.players[game.localPlayerId].position.y - camera.y;
    // Draw local player
    ctx.fillStyle = "orange";
    ctx.fillRect(offsetX, offsetY, game.localPlayerSize, game.localPlayerSize);
    // Draw other players
    ctx.fillStyle = "gray";
    Object.keys(game.players).forEach(function (playerId) {
        if (+playerId !== game.localPlayerId) {
            ctx.fillRect(game.players[+playerId].position.x - camera.x, game.players[+playerId].position.y - camera.y, game.localPlayerSize, game.localPlayerSize);
        }
    });
}
function gameLoop() {
    if (currentGameState === GameState.RUNNING) {
        updatePlayerPosition();
        render();
    }
    requestAnimationFrame(gameLoop);
}
conn.onopen = function () {
    gameLoop();
};
