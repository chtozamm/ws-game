const conn = new WebSocket("ws://" + document.location.host + "/ws")

interface Player {
  id: number
  x: number
  y: number
}

interface Players {
  [id: number]: { x: number, y: number }
}

interface Message {
  type: "init" | "connect" | "disconnect" | "pos_update"
  data: any
}

let id: number

const players: Players = {}

conn.onmessage = (ev) => {
  const message: Message = JSON.parse(ev.data)
  switch (message.type) {
    case "init":
      id = +message.data.id
      players[id] = {} as Player
      players[id].x = +message.data.players[id].x
      players[id].y = +message.data.players[id].y
      Object.keys(message.data.players as Players).forEach((key) => {
        players[+key] = { x: +message.data.players[key].x, y: +message.data.players[key].y }
      })
      break
    case "connect":
      let playerId = +message.data.id
      players[playerId] = {} as Player
      players[playerId].x = +message.data.x
      players[playerId].y = +message.data.y
      break
    case "disconnect":
      playerId = +message.data
      delete players[playerId]
      break
    case "pos_update":
      playerId = +message.data.id
      players[playerId].x = +message.data.x
      players[playerId].y = +message.data.y
      break
  }
  console.log(`---
  message type: ${message.type}
  number of players: ${Object.keys(players).length}
  players: ${JSON.stringify(players)}
---`)
  //  id: ${id}
  //x: ${players[id].x}
  //y: ${players[id].y}
}
