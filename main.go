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
	ID int `json:"id"`
	X  int `json:"x"`
	Y  int `json:"y"`
}

type Message struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

type InitMessage struct {
	ID      int     `json:"id"`
	Players Players `json:"players"`
}

type Coordinates struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type Players map[int]Coordinates

var (
	nextID          = 0
	players Players = make(Players)
	mu      sync.Mutex
)

func handleWebsocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("Failed to upgrade connection: %v\n", err)
	}
	defer func() {
		conn.Close()
		id := connections[conn]
		delete(connections, conn)
		delete(players, id)
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
	players[nextID] = Coordinates{X: 200, Y: 200}
	connections[conn] = nextID
	mu.Unlock()

	fmt.Printf("Player %d connected.\n", nextID)

	err = conn.WriteJSON(Message{Type: "init", Data: InitMessage{ID: nextID, Players: players}})
	if err != nil {
		fmt.Printf("Error writing to connection: %v\n", err)
	}

	for conn, id := range connections {
		if id != nextID {
			err = conn.WriteJSON(Message{Type: "connect", Data: Player{ID: nextID, X: 200, Y: 200}})
			if err != nil {
				fmt.Printf("Error writing (broadcast \"connect\") to connection: %v\n", err)
			}
		}
	}

	for {
		msg := Message{}
		err = conn.ReadJSON(&msg)
		if err != nil {
			return
		}

		if msg.Type == "pos_update" {
			for conn, id := range connections {
				if id != msg.Data {
					err = conn.WriteJSON(Message{Type: "pos_update", Data: msg.Data})
					if err != nil {
						fmt.Printf("Error writing (broadcast \"pos_update\") to connection: %v\n", err)
					}
				}
			}
		}
	}
}

var connections = make(map[*websocket.Conn]int)
