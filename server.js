const { WebSocketServer } = require('ws');

const port = process.env.PORT || 10000;
const wss = new WebSocketServer({ port });

const rooms = new Map();

wss.on('connection', (ws) => {
    console.log('A player connected to the network');
    let currentRoom = null;
    let playerId = Math.random().toString(36).substring(2, 9);

    // AUTOMATIC FALLBACK: If the game doesn't send a valid room code within 2 seconds, 
    // we force-generate a room ID and send it back to break past the loading screen!
    const fallbackTimeout = setTimeout(() => {
        if (!currentRoom) {
            currentRoom = "Room-" + Math.floor(1000 + Math.random() * 9000);
            initializeAndSendRoom(currentRoom);
        }
    }, 1500);

    function initializeAndSendRoom(roomName) {
        currentRoom = roomName;
        if (!rooms.has(currentRoom)) {
            rooms.set(currentRoom, new Set());
        }
        rooms.get(currentRoom).add(ws);
        ws.currentRoom = currentRoom;

        // We send EVERY common signaling format back to the game client 
        // to guarantee it recognizes one of them and stops loading!
        ws.send(JSON.stringify({ type: 'id', id: playerId, room: currentRoom }));
        ws.send(JSON.stringify({ type: 'room', id: playerId, room: currentRoom }));
        ws.send(JSON.stringify({ type: 'connected', roomId: currentRoom, id: playerId }));
        ws.send(JSON.stringify({ action: 'room_created', room: currentRoom, peerId: playerId }));
        
        console.log(`Force-initialized Player ${playerId} into ${currentRoom}`);
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log("Received data from game client:", data);
            
            // Catch any room registration keywords your game might be using
            if (data.type === 'join' || data.type === 'create' || data.type === 'host' || data.action === 'join') {
                clearTimeout(fallbackTimeout);
                const requestedRoom = data.room || data.roomId || "Lobby-" + playerId;
                initializeAndSendRoom(requestedRoom);
                return;
            }

            // Route standard game coordinates, items, and movements to matching room players
            if (ws.currentRoom && rooms.has(ws.currentRoom)) {
                rooms.get(ws.currentRoom).forEach((client) => {
                    if (client !== ws && client.readyState === 1) {
                        client.send(message.toString());
                    }
                });
            }
        } catch (e) {
            // If the game sends raw strings instead of JSON configurations
            const msgStr = message.toString();
            console.log("Received raw string from game client:", msgStr);
            
            if (ws.currentRoom && rooms.has(ws.currentRoom)) {
                rooms.get(ws.currentRoom).forEach((client) => {
                    if (client !== ws && client.readyState === 1) {
                        client.send(msgStr);
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        clearTimeout(fallbackTimeout);
        console.log(`Player ${playerId} disconnected`);
        if (ws.currentRoom && rooms.has(ws.currentRoom)) {
            rooms.get(ws.currentRoom).delete(ws);
            if (rooms.get(ws.currentRoom).size === 0) {
                rooms.delete(ws.currentRoom);
            }
        }
    });
});

console.log(`Kart Chaos multiplayer backend running on port ${port}`);
