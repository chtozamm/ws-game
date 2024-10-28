const conn = new WebSocket("ws://" + document.location.host + "/ws")

enum GameState {
  INITIALIZING,
  RUNNING,
}

let currentGameState: GameState = GameState.INITIALIZING;

interface Coordinates {
  x: number;
  y: number;
}

type PlayerID = number

interface Player {
  id: number
  position: Coordinates
}

interface Players {
  [id: number]: { position: Coordinates }
}

interface InitData {
  player_id: number;
  player_size: number;
  player_speed: number;
  world_width: number;
  world_height: number;
  players: Players;
}

interface ServerMessage {
  type: "init" | "connect" | "disconnect" | "pos_update"
  data: any
}

interface ClientMessage {
  type: "pos_update"
  data: any
}

interface Game {
  localPlayerId: PlayerID
  localPlayerSize: number
  playerSpeed: number
  worldHeight: number
  worldWidth: number
  players: Players
}

const game: Game = {
  localPlayerId: 0,
  localPlayerSize: 0,
  playerSpeed: 0,
  worldHeight: 0,
  worldWidth: 0,
  players: {},
}

function setPlayer(playerId: PlayerID, position: Coordinates) {
  game.players[playerId] = { position: position }
}

function deletePlayer(playerId: PlayerID) {
  delete game.players[playerId]
}

conn.onmessage = (ev) => {
  const message: ServerMessage = JSON.parse(ev.data)
  switch (message.type) {
    case "init":
      const initData = message.data as InitData
      game.localPlayerId = initData.player_id
      game.localPlayerSize = initData.player_size
      game.playerSpeed = initData.player_speed
      game.worldWidth = initData.world_width
      game.worldHeight = initData.world_height
      game.players = initData.players
      currentGameState = GameState.RUNNING;
      break
    case "connect":
      const connectData = message.data as Player
      setPlayer(connectData.id, { x: connectData.position.x, y: connectData.position.y })
      break
    case "disconnect":
      deletePlayer(message.data as PlayerID)
      break
    case "pos_update":
      const posUpdateData = message.data as Player
      setPlayer(posUpdateData.id, { x: posUpdateData.position.x, y: posUpdateData.position.y })
      break
  }
}

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement
canvas.width = window.innerWidth
canvas.height = window.innerHeight

const camera = {
  x: 0,
  y: 0,
}

const keysPressed: { [key: string]: boolean } = {};

const KEY_W = "w";
const KEY_A = "a";
const KEY_S = "s";
const KEY_D = "d";
const KEY_UP = "ArrowUp";
const KEY_DOWN = "ArrowDown";
const KEY_LEFT = "ArrowLeft";
const KEY_RIGHT = "ArrowRight";

addEventListener("keydown", (ev) => {
  keysPressed[ev.key] = true;
});

addEventListener("keyup", (ev) => {
  keysPressed[ev.key] = false;
});

function updatePlayerPosition() {
  let moveX = 0
  let moveY = 0

  if (keysPressed[KEY_W] || keysPressed[KEY_UP]) {
    if (game.players[game.localPlayerId].position.y > 0) {
      moveY = -1
    }
  }
  if (keysPressed[KEY_S] || keysPressed[KEY_DOWN]) {
    if (
      game.players[game.localPlayerId].position.y <
      game.worldHeight - game.localPlayerSize
    ) {
      moveY = 1
    }
  }
  if (keysPressed[KEY_A] || keysPressed[KEY_LEFT]) {
    if (game.players[game.localPlayerId].position.x > 0) {
      moveX = -1
    }
  }
  if (keysPressed[KEY_D] || keysPressed[KEY_RIGHT]) {
    if (
      game.players[game.localPlayerId].position.x <
      game.worldWidth - game.localPlayerSize
    ) {
      moveX = 1
    }
  }

  // Normalize the movement vector if both axes are pressed
  const length = Math.sqrt(moveX * moveX + moveY * moveY)
  if (length > 0) {
    moveX /= length
    moveY /= length
  }

  const newX = Math.min(
    Math.max(game.players[game.localPlayerId].position.x + moveX * game.playerSpeed, 0),
    game.worldWidth - game.localPlayerSize,
  )
  const newY = Math.min(
    Math.max(game.players[game.localPlayerId].position.y + moveY * game.playerSpeed, 0),
    game.worldHeight - game.localPlayerSize,
  )

  const msg: ClientMessage = {
    type: "pos_update",
    data: {
      id: game.localPlayerId,
      position: {
        x: newX,
        y: newY
      }
    } as Player,
  }

  // Send player position if moved
  if (moveX !== 0 || moveY !== 0) {
    conn.send(JSON.stringify(msg))
  }

  // Update camera position to center on the player
  const halfCanvasWidth = canvas.width / 2
  const halfCanvasHeight = canvas.height / 2

  camera.x = Math.max(
    0,
    Math.min(
      game.players[game.localPlayerId].position.x -
      halfCanvasWidth +
      game.localPlayerSize / 2,
      game.worldWidth - canvas.width,
    ),
  )
  camera.y = Math.max(
    0,
    Math.min(
      game.players[game.localPlayerId].position.y -
      halfCanvasHeight +
      game.localPlayerSize / 2,
      game.worldHeight - canvas.height,
    ),
  )
}

const ctx = canvas.getContext("2d") as CanvasRenderingContext2D

let score = 0

function drawScore() {
  ctx.fillStyle = 'white'
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 2
  ctx.font = '20px Arial'
  ctx.strokeText(`Score: ${score}`, 10, 30)
  ctx.fillText(`Score: ${score}`, 10, 30)
}

function drawPlayers() {
  // Calculate camera offsets
  const offsetX = game.players[game.localPlayerId].position.x - camera.x
  const offsetY = game.players[game.localPlayerId].position.y - camera.y

  // Draw local player
  ctx.fillStyle = "orange"
  ctx.fillRect(offsetX, offsetY, game.localPlayerSize, game.localPlayerSize)

  // Draw other players
  ctx.fillStyle = "gray"
  Object.keys(game.players).forEach((playerId) => {
    if (+playerId !== game.localPlayerId) {
      ctx.fillRect(
        game.players[+playerId].position.x - camera.x,
        game.players[+playerId].position.y - camera.y,
        game.localPlayerSize,
        game.localPlayerSize,
      )
    }
  })
}

function drawBackground() {
  const tileSize = 200
  const lightTileColor = "#6b7c7f"
  const darkTileColor = "#abc6cb"

  const startX = Math.floor(camera.x / tileSize) * tileSize
  const startY = Math.floor(camera.y / tileSize) * tileSize

  // Calculate the number of tiles to draw based on the world dimensions
  const numTilesX = Math.ceil(game.worldWidth / tileSize) + 1 // +1 to ensure we cover the right edge
  const numTilesY = Math.ceil(game.worldHeight / tileSize) + 1 // +1 to ensure we cover the bottom edge

  // Loop through the number of tiles to draw
  for (let y = 0; y < numTilesY; y++) {
    for (let x = 0; x < numTilesX; x++) {
      // Calculate the actual position of the tile
      const tileX = startX + x * tileSize;
      const tileY = startY + y * tileSize;

      // Determine the color based on the tile's position
      const isLightTile = (Math.floor(tileX / tileSize) + Math.floor(tileY / tileSize)) % 2 === 0;
      ctx.fillStyle = isLightTile ? lightTileColor : darkTileColor;
      ctx.fillRect(tileX - camera.x, tileY - camera.y, tileSize, tileSize);
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawBackground()
  drawPlayers()
  drawScore()
}

function gameLoop() {
  if (currentGameState === GameState.RUNNING) {
    updatePlayerPosition()
    render()
  }
  requestAnimationFrame(gameLoop)
}

conn.onopen = () => {
  gameLoop()
}
