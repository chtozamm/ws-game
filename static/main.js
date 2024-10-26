var conn = new WebSocket("ws://" + document.location.host + "/ws");
var id;
var players = {};
conn.onmessage = function (ev) {
    var message = JSON.parse(ev.data);
    switch (message.type) {
        case "init":
            id = +message.data.id;
            players[id] = {};
            players[id].x = +message.data.players[id].x;
            players[id].y = +message.data.players[id].y;
            Object.keys(message.data.players).forEach(function (key) {
                players[+key] = { x: +message.data.players[key].x, y: +message.data.players[key].y };
            });
            break;
        case "connect":
            var playerId = +message.data.id;
            players[playerId] = {};
            players[playerId].x = +message.data.x;
            players[playerId].y = +message.data.y;
            break;
        case "disconnect":
            playerId = +message.data;
            delete players[playerId];
            break;
        case "pos_update":
            playerId = +message.data.id;
            players[playerId].x = +message.data.x;
            players[playerId].y = +message.data.y;
            break;
    }
    console.log("---\n  message type: ".concat(message.type, "\n  number of players: ").concat(Object.keys(players).length, "\n  players: ").concat(JSON.stringify(players), "\n---"));
    //  id: ${id}
    //x: ${players[id].x}
    //y: ${players[id].y}
};
