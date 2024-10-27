package main

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

func main() {
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir("static")))
	mux.HandleFunc("/ws", handleWebsocket)

	server := &http.Server{
		Addr:    "localhost:8080",
		Handler: mux,
	}

	fmt.Println("Listening on http://localhost:8080")

	if err := server.ListenAndServe(); err != nil {
		fmt.Printf("Error starting server: %v\n", err)
	}
}

var upgrader = websocket.Upgrader{}

type Player struct {
	ID       int         `json:"id"`
	Position Coordinates `json:"position"`
}

type Message struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

type ClientMessage struct {
	Type string `json:"type"`
	Data Player `json:"data"`
}

type InitMessage struct {
	PlayerID    int     `json:"player_id"`
	Players     Players `json:"players"`
	WorldWidth  int     `json:"world_width"`
	WorldHeight int     `json:"world_height"`
	PlayerSpeed int     `json:"player_speed"`
	PlayerSize  int     `json:"player_size"`
}

type Coordinates struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Players map[int]Player

var (
	nextID          = 0
	players Players = make(Players)
	mu      sync.Mutex
)

func handleWebsocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "Failed to upgrade connection", http.StatusInternalServerError)
		return
	}
	defer func() {
		conn.Close()
		mu.Lock()
		id := connections[conn]
		delete(connections, conn)
		delete(players, id)
		mu.Unlock()
		fmt.Printf("Player %d disconnected.\n", id)
		for conn := range connections {
			err = conn.WriteJSON(Message{Type: "disconnect", Data: id})
			if err != nil {
				fmt.Printf("Error writing (broadcast \"disconnect\") to connection: %v\n", err)
			}
		}
	}()

	mu.Lock()
	nextID++
	players[nextID] = Player{Position: Coordinates{X: 200, Y: 200}}
	connections[conn] = nextID
	mu.Unlock()

	fmt.Printf("Player %d connected.\n", nextID)

	err = conn.WriteJSON(Message{Type: "init", Data: InitMessage{PlayerID: nextID, PlayerSize: 50, PlayerSpeed: 5, Players: players, WorldWidth: 2500, WorldHeight: 2500}})
	if err != nil {
		fmt.Printf("Error writing to connection: %v\n", err)
	}

	for conn, id := range connections {
		if id != nextID {
			err = conn.WriteJSON(Message{Type: "connect", Data: Player{ID: nextID, Position: Coordinates{X: 200, Y: 200}}})
			if err != nil {
				fmt.Printf("Error writing (broadcast \"connect\") to connection: %v\n", err)
			}
		}
	}

	for {
		msg := ClientMessage{}
		err = conn.ReadJSON(&msg)
		if err != nil {
			return
		}

		if msg.Type == "pos_update" {
			// fmt.Printf("Message from client: %v\n", msg)

			mu.Lock()
			players[msg.Data.ID] = Player{Position: Coordinates{X: msg.Data.Position.X, Y: msg.Data.Position.Y}}
			mu.Unlock()
			for conn := range connections {
				// if id != msg.Data.ID {
				err = conn.WriteJSON(Message{Type: "pos_update", Data: msg.Data})
				if err != nil {
					fmt.Printf("Error writing (broadcast \"pos_update\") to connection: %v\n", err)
				}
				// }
			}
		}
	}
}

var connections = make(map[*websocket.Conn]int)
