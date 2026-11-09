const { WebSocketServer } = require('ws');

const port = process.env.PORT || 10000;
const wss = new WebSocketServer({ port });

const rooms = new Map();
let globalPlayerCounter = 1000;

wss.on('connection', (ws) => {
    console.log('Player linked to socket channel');
    
    const playerId = globalPlayerCounter++;
    let currentRoomId = null;
    let playerNickname = "Driver";

    // Step 1: Send the mandatory hello handshake
    ws.send(JSON.stringify({
        t: 'hello',
        id: playerId
    }));

    ws.on('message', (message) => {
        try {
            const m = JSON.parse(message);
            
            // Handle lobby creation and room entries
            if (m.t === 'join' || m.t === 'create' || m.type === 'join' || m.action === 'join') {
                playerNickname = m.name || "Player " + playerId;
                
                // FIXED LOGIC: If no room name is supplied (Create Room button), 
                // we strictly use the Host's Player ID string so the client maps it perfectly!
                currentRoomId = m.room || String(playerId);
                
                if (!rooms.has(currentRoomId)) {
                    rooms.set(currentRoomId, new Map());
                }
                
                const roomPlayers = rooms.get(currentRoomId);
                roomPlayers.set(playerId, { ws, name: playerNickname, id: playerId });
                ws.currentRoom = currentRoomId;
                ws.playerId = playerId;

                const playersArray = [];
                roomPlayers.forEach((player) => {
                    playersArray.push({ id: player.id, name: player.name });
                });

                // Step 2: Confirm connection utilizing the game's strict schema
                ws.send(JSON.stringify({
                    t: 'joined',
                    room: currentRoomId,
                    id: playerId,
                    players: playersArray
                }));

                // Alert alternative drivers residing inside that match room
                roomPlayers.forEach((player) => {
                    if (player.id !== playerId && player.ws.readyState === 1) {
                        player.ws.send(JSON.stringify({
                            t: 'peer_join',
                            id: playerId,
                            name: playerNickname
                        }));
                    }
                });

                console.log(`Driver ${playerNickname} (${playerId}) initialized into room: ${currentRoomId}`);
                return;
            }

            // Standard synchronization relay fallback (state adjustments, telemetry, item triggers)
            if (ws.currentRoom && rooms.has(ws.currentRoom)) {
                const roomPlayers = rooms.get(ws.currentRoom);
                roomPlayers.forEach((player) => {
                    if (player.id !== ws.playerId && player.ws.readyState === 1) {
                        m.id = ws.playerId; 
                        player.ws.send(JSON.stringify(m));
                    }
                });
            }

        } catch (err) {
            if (ws.currentRoom && rooms.has(ws.currentRoom)) {
                rooms.get(ws.currentRoom).forEach((player) => {
                    if (player.id !== ws.playerId && player.ws.readyState === 1) {
                        player.ws.send(message.toString());
                    }
                });
            }
        }
    });

    ws.on('close', () => {
        console.log(`Driver ${playerId} disconnected`);
        if (ws.currentRoom && rooms.has(ws.currentRoom)) {
            const roomPlayers = rooms.get(ws.currentRoom);
            roomPlayers.delete(playerId);

            roomPlayers.forEach((player) => {
                if (player.ws.readyState === 1) {
                    player.ws.send(JSON.stringify({
                        t: 'peer_leave',
                        id: playerId
                    }));
                }
            });

            if (roomPlayers.size === 0) {
                rooms.delete(ws.currentRoom);
            }
        }
    });
});

console.log(`Kart Chaos matching gateway engine listening on port ${port}`);
