package main

import (
	"fmt"
	"math/rand/v2"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

func main() {
	populateCollectableItems()
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir("static")))
	mux.HandleFunc("/ws", handleWebsocket)

	server := &http.Server{
		Addr:    "0.0.0.0:8080",
		Handler: mux,
	}

	fmt.Println("Listening on http://localhost:8080")

	if err := server.ListenAndServe(); err != nil {
		fmt.Printf("Error starting server: %v\n", err)
	}
}

func populateCollectableItems() {
	for i := 1; i < 50; i++ {
		x := rand.Float64() * float64(worldWidth)
		y := rand.Float64() * float64(worldHeight)
		collectableItems[i] = CollectableItem{Position: Coordinates{X: x, Y: y}}
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
	Type string            `json:"type"`
	Data ClientMessageData `json:"data"`
}

type ClientMessageData struct {
	ID       int         `json:"id"`
	Position Coordinates `json:"position"`
}

type InitMessage struct {
	PlayerID            int              `json:"player_id"`
	Players             Players          `json:"players"`
	WorldWidth          int              `json:"world_width"`
	WorldHeight         int              `json:"world_height"`
	PlayerSpeed         int              `json:"player_speed"`
	PlayerSize          int              `json:"player_size"`
	CollectableItems    CollectableItems `json:"collectable_items"`
	CollectableItemSize int              `json:"collectable_item_size"`
	Score               int              `json:"score"`
}

type Coordinates struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type CollectableItem struct {
	ID       int         `json:"id"`
	Position Coordinates `json:"position"`
}

type (
	Players          map[int]Player
	CollectableItems map[int]CollectableItem
)

var (
	nextID                      = 0
	players             Players = make(Players)
	mu                  sync.Mutex
	worldWidth                           = 2500
	worldHeight                          = 2500
	startPosition                        = Coordinates{X: float64(worldWidth / 2), Y: float64(worldHeight / 2)}
	playerSpeed                          = 5
	playerSize                           = 50
	collectableItemSize                  = 10
	collectableItems    CollectableItems = make(CollectableItems)
	score                                = 0
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
	players[nextID] = Player{Position: startPosition}
	connections[conn] = nextID
	mu.Unlock()

	fmt.Printf("Player %d connected.\n", nextID)

	err = conn.WriteJSON(Message{Type: "init", Data: InitMessage{PlayerID: nextID, PlayerSize: playerSize, PlayerSpeed: playerSpeed, Players: players, WorldWidth: worldWidth, WorldHeight: worldHeight, CollectableItemSize: collectableItemSize, Score: score, CollectableItems: collectableItems}})
	if err != nil {
		fmt.Printf("Error writing to connection: %v\n", err)
	}

	for conn, id := range connections {
		if id != nextID {
			err = conn.WriteJSON(Message{Type: "connect", Data: Player{ID: nextID, Position: startPosition}})
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
		// fmt.Printf("Message from client: %v\n", msg)

		if msg.Type == "pos_update" {
			mu.Lock()
			players[msg.Data.ID] = Player{Position: Coordinates{X: msg.Data.Position.X, Y: msg.Data.Position.Y}}
			mu.Unlock()
			for conn := range connections {
				err = conn.WriteJSON(Message{Type: "pos_update", Data: msg.Data})
				if err != nil {
					fmt.Printf("Error writing (broadcast \"pos_update\") to connection: %v\n", err)
				}
			}
		}

		if msg.Type == "collect_item" {
			mu.Lock()
			delete(collectableItems, msg.Data.ID)
			score++
			mu.Unlock()
			for conn := range connections {
				err = conn.WriteJSON(Message{Type: "collect_item", Data: msg.Data.ID})
				if err != nil {
					fmt.Printf("Error writing (broadcast \"collect_item\") to connection: %v\n", err)
				}
			}
		}
	}
}

var connections = make(map[*websocket.Conn]int)
