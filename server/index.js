// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/gaple-game', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// MongoDB Schemas
const roomSchema = new mongoose.Schema({
    roomId: { type: String, unique: true, required: true },
    players: [{
        playerId: String,
        playerName: String,
        socketId: String,
        totalScore: { type: Number, default: 0 },
        isHost: { type: Boolean, default: false },
        joinedAt: { type: Date, default: Date.now }
    }],
    gameState: {
        isStarted: { type: Boolean, default: false },
        currentPlayer: { type: Number, default: 0 },
        round: { type: Number, default: 1 },
        maxPoint: { type: Number, default: 100 },
        board: [{ left: Number, right: Number }],
        playerHands: [[{ left: Number, right: Number }]],
        roundEnded: { type: Boolean, default: false },
        gameEnded: { type: Boolean, default: false },
        lastWinner: String, // untuk menentukan pemain pertama round selanjutnya
        gapleCard: { left: Number, right: Number }, // kartu gaple untuk round selanjutnya
        roundEndType: String, // 'winner', 'gaple', 'blocked'
        currentRoundFirstPlayerType: String // 'double_zero', 'winner', 'gaple', 'fallback'
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const gameHistorySchema = new mongoose.Schema({
    roomId: String,
    players: [String],
    winner: String,
    finalScores: [{ playerName: String, score: Number }],
    rounds: Number,
    duration: Number,
    completedAt: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', roomSchema);
const GameHistory = mongoose.model('GameHistory', gameHistorySchema);

// Game Logic Class
class GapleGameEngine {
    constructor() {
        this.dominoSet = this.createDominoSet();
    }

    createDominoSet() {
        const dominos = [];
        for (let i = 0; i <= 6; i++) {
            for (let j = i; j <= 6; j++) {
                dominos.push({ left: i, right: j });
            }
        }
        return dominos;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    dealCards() {
        const shuffled = this.shuffleArray(this.dominoSet);
        const hands = [[], [], [], []];
        
        // Bagikan 7 kartu ke setiap pemain (total 28 kartu)
        for (let i = 0; i < 28; i++) {
            hands[i % 4].push(shuffled[i]);
        }
        
        return hands;
    }

    findPlayerWithDoubleZero(playerHands) {
        for (let i = 0; i < playerHands.length; i++) {
            const hasDoubleZero = playerHands[i].some(card => 
                card.left === 0 && card.right === 0
            );
            if (hasDoubleZero) return i;
        }
        return 0; // fallback
    }

    findPlayerWithCard(playerHands, targetCard) {
        for (let i = 0; i < playerHands.length; i++) {
            const hasCard = playerHands[i].some(card => 
                card.left === targetCard.left && card.right === targetCard.right
            );
            if (hasCard) return i;
        }
        return null;
    }

    findPlayerWithHighestDouble(playerHands) {
        for (let value = 6; value >= 0; value--) {
            for (let i = 0; i < playerHands.length; i++) {
                const hasDouble = playerHands[i].some(card => 
                    card.left === value && card.right === value
                );
                if (hasDouble) return { playerIndex: i, card: { left: value, right: value } };
            }
        }
        return { playerIndex: 0, card: { left: 0, right: 0 } };
    }

    determineFirstPlayer(playerHands, lastWinner, gapleCard, roundEndType) {
        if (lastWinner !== null && lastWinner !== undefined) {
            return { 
                playerIndex: lastWinner, 
                type: 'winner',
                mustPlayDouble: true 
            };
        }

        if (roundEndType === 'gaple' && gapleCard) {
            const playerIndex = this.findPlayerWithCard(playerHands, gapleCard);
            if (playerIndex !== null) {
                return { 
                    playerIndex, 
                    type: 'gaple',
                    requiredCard: gapleCard 
                };
            }
        }

        // Round pertama atau fallback
        const doubleZeroPlayer = this.findPlayerWithDoubleZero(playerHands);
        if (doubleZeroPlayer !== null) {
            return { 
                playerIndex: doubleZeroPlayer, 
                type: 'double_zero',
                requiredCard: { left: 0, right: 0 }
            };
        }

        // Ultimate fallback
        const highest = this.findPlayerWithHighestDouble(playerHands);
        return { 
            playerIndex: highest.playerIndex, 
            type: 'fallback',
            requiredCard: highest.card 
        };
    }

    canPlayCard(card, board, position = null) {
        if (board.length === 0) {
            return true;
        }

        const leftEnd = board[0].left;
        const rightEnd = board[board.length - 1].right;

        if (position === 'left') {
            return card.left === leftEnd || card.right === leftEnd;
        } else if (position === 'right') {
            return card.left === rightEnd || card.right === rightEnd;
        } else {
            return card.left === leftEnd || card.right === leftEnd ||
                   card.left === rightEnd || card.right === rightEnd;
        }
    }

    validateOpeningCard(card, firstPlayerInfo, playerHand) {
        if (firstPlayerInfo.type === 'double_zero') {
            return card.left === 0 && card.right === 0;
        }

        if (firstPlayerInfo.type === 'gaple' && firstPlayerInfo.requiredCard) {
            return card.left === firstPlayerInfo.requiredCard.left && 
                   card.right === firstPlayerInfo.requiredCard.right;
        }

        if (firstPlayerInfo.type === 'winner') {
            // Cek apakah punya kartu balak
            const doubleCards = playerHand.filter(c => c.left === c.right);
            if (doubleCards.length > 0) {
                // Harus main kartu balak
                return card.left === card.right;
            }
            // Jika tidak punya balak, boleh main apa saja
            return true;
        }

        if (firstPlayerInfo.type === 'fallback') {
            return card.left === firstPlayerInfo.requiredCard.left && 
                   card.right === firstPlayerInfo.requiredCard.right;
        }

        return true;
    }

    playCard(card, board, position) {
        let playedCard = { ...card };
        
        if (board.length === 0) {
            return [playedCard];
        }

        const leftEnd = board[0].left;
        const rightEnd = board[board.length - 1].right;

        if (position === 'left') {
            if (playedCard.right !== leftEnd) {
                [playedCard.left, playedCard.right] = [playedCard.right, playedCard.left];
            }
            return [playedCard, ...board];
        } else {
            if (playedCard.left !== rightEnd) {
                [playedCard.left, playedCard.right] = [playedCard.right, playedCard.left];
            }
            return [...board, playedCard];
        }
    }

    isGameBlocked(playerHands, board) {
        return playerHands.every(hand => 
            hand.every(card => !this.canPlayCard(card, board))
        );
    }

    detectGaple(board) {
        if (board.length === 0) return null;
        
        const leftEnd = board[0].left;
        const rightEnd = board[board.length - 1].right;
        
        if (leftEnd === rightEnd) {
            return { left: leftEnd, right: rightEnd };
        }
        return null;
    }

    calculateRoundPoints(playerHands) {
        return playerHands.map(hand => {
            let points = 0;
            let hasDoubleZero = false;
            let hasOtherZero = false;

            // Cek semua kartu di tangan semua pemain untuk aturan 0-0
            playerHands.forEach(allHands => {
                allHands.forEach(card => {
                    if (card.left === 0 && card.right === 0) {
                        hasDoubleZero = true;
                    } else if (card.left === 0 || card.right === 0) {
                        hasOtherZero = true;
                    }
                });
            });

            // Hitung poin untuk tangan ini
            hand.forEach(card => {
                if (card.left === 0 && card.right === 0) {
                    if (!hasOtherZero) {
                        points += 25; // Aturan khusus 0-0
                    }
                    // Jika ada kartu 0 lain, 0-0 = 0 poin
                } else {
                    points += card.left + card.right;
                }
            });

            return points;
        });
    }
}

// In-memory storage untuk rooms aktif (untuk performance)
const activeRooms = new Map();

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Create Room
    socket.on('createRoom', async (data) => {
        try {
            const { playerName } = data;
            const roomId = generateRoomId();
            const playerId = generatePlayerId();

            const room = new Room({
                roomId,
                players: [{
                    playerId,
                    playerName: playerName.trim().substring(0, 15),
                    socketId: socket.id,
                    isHost: true
                }]
            });

            await room.save();
            activeRooms.set(roomId, room);

            socket.join(roomId);
            socket.playerId = playerId;
            socket.roomId = roomId;

            socket.emit('roomCreated', {
                roomId,
                playerId,
                players: room.players.map(p => ({
                    playerId: p.playerId,
                    playerName: p.playerName,
                    totalScore: p.totalScore,
                    isHost: p.isHost
                }))
            });

            console.log(`Room created: ${roomId} by ${playerName}`);
        } catch (error) {
            socket.emit('error', { message: 'Gagal membuat room' });
            console.error('Create room error:', error);
        }
    });

    // Join Room
    socket.on('joinRoom', async (data) => {
        try {
            const { roomId, playerName } = data;
            const playerId = generatePlayerId();

            let room = await Room.findOne({ roomId });
            if (!room) {
                socket.emit('roomNotFound');
                return;
            }

            if (room.players.length >= 4) {
                socket.emit('roomFull');
                return;
            }

            if (room.gameState.isStarted) {
                socket.emit('error', { message: 'Game sudah dimulai' });
                return;
            }

            room.players.push({
                playerId,
                playerName: playerName.trim().substring(0, 15),
                socketId: socket.id
            });

            room.updatedAt = new Date();
            await room.save();

            activeRooms.set(roomId, room);

            socket.join(roomId);
            socket.playerId = playerId;
            socket.roomId = roomId;

            const playersData = room.players.map(p => ({
                playerId: p.playerId,
                playerName: p.playerName,
                totalScore: p.totalScore,
                isHost: p.isHost
            }));

            io.to(roomId).emit('playerJoined', {
                players: playersData,
                newPlayer: {
                    playerId,
                    playerName: playerName.trim().substring(0, 15)
                }
            });

            socket.emit('roomJoined', {
                roomId,
                playerId,
                players: playersData
            });

            console.log(`Player ${playerName} joined room ${roomId}`);
        } catch (error) {
            socket.emit('error', { message: 'Gagal join room' });
            console.error('Join room error:', error);
        }
    });

    // Start Game
    socket.on('startGame', async (data) => {
        try {
            const { roomId } = data;
            let room = await Room.findOne({ roomId });

            if (!room) {
                socket.emit('roomNotFound');
                return;
            }

            const player = room.players.find(p => p.socketId === socket.id);
            if (!player?.isHost) {
                socket.emit('error', { message: 'Hanya host yang bisa memulai game' });
                return;
            }

            if (room.players.length !== 4) {
                socket.emit('error', { message: 'Butuh 4 pemain untuk memulai game' });
                return;
            }

            const gameEngine = new GapleGameEngine();
            const playerHands = gameEngine.dealCards();
            const firstPlayerInfo = gameEngine.determineFirstPlayer(
                playerHands, null, null, null
            );

            room.gameState = {
                isStarted: true,
                currentPlayer: firstPlayerInfo.playerIndex,
                round: 1,
                maxPoint: 100,
                board: [],
                playerHands,
                roundEnded: false,
                gameEnded: false,
                lastWinner: null,
                gapleCard: null,
                roundEndType: null,
                currentRoundFirstPlayerType: firstPlayerInfo.type
            };

            room.updatedAt = new Date();
            await room.save();
            activeRooms.set(roomId, room);

            const gameData = {
                gameState: {
                    currentPlayer: room.gameState.currentPlayer,
                    round: room.gameState.round,
                    maxPoint: room.gameState.maxPoint,
                    board: room.gameState.board,
                    currentTurn: room.players[room.gameState.currentPlayer].playerName,
                    firstPlayerType: firstPlayerInfo.type,
                    requiredCard: firstPlayerInfo.requiredCard
                },
                players: room.players.map(p => ({
                    playerId: p.playerId,
                    playerName: p.playerName,
                    totalScore: p.totalScore
                }))
            };

            // Send game data to each player with their hand
            room.players.forEach((player, index) => {
                const playerSocket = io.sockets.sockets.get(player.socketId);
                if (playerSocket) {
                    playerSocket.emit('gameStarted', {
                        ...gameData,
                        myPlayerIndex: index,
                        myCards: room.gameState.playerHands[index]
                    });
                }
            });

            console.log(`Game started in room ${roomId}`);
        } catch (error) {
            socket.emit('error', { message: 'Gagal memulai game' });
            console.error('Start game error:', error);
        }
    });

    // Play Card
    socket.on('playCard', async (data) => {
        try {
            const { roomId, cardIndex, position } = data;
            let room = await Room.findOne({ roomId });

            if (!room || !room.gameState.isStarted) {
                socket.emit('error', { message: 'Game belum dimulai' });
                return;
            }

            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== room.gameState.currentPlayer) {
                socket.emit('error', { message: 'Bukan giliran Anda' });
                return;
            }

            const playerHand = room.gameState.playerHands[playerIndex];
            const selectedCard = playerHand[cardIndex];
            console.log("selectedCard:", selectedCard, "cardIndex:", cardIndex, "position:", position);

            if (!selectedCard) {
                socket.emit('error', { message: 'Kartu tidak valid' });
                return;
            }

            const gameEngine = new GapleGameEngine();

            // Validasi kartu pembuka
            if (room.gameState.board.length === 0) {
                const firstPlayerInfo = {
                    type: room.gameState.currentRoundFirstPlayerType,
                    requiredCard: null // This should be stored in gameState if needed
                };
                
                if (!gameEngine.validateOpeningCard(selectedCard, firstPlayerInfo, playerHand)) {
                    socket.emit('error', { message: 'Kartu pembuka tidak sesuai aturan' });
                    return;
                }
            } else {
                // Validasi kartu biasa
                if (!gameEngine.canPlayCard(selectedCard, room.gameState.board, position)) {
                    socket.emit('error', { message: 'Kartu tidak bisa dimainkan di posisi tersebut' });
                    return;
                }
            }

            // Play the card
            room.gameState.board = gameEngine.playCard(selectedCard, room.gameState.board, position);
            playerHand.splice(cardIndex, 1);

            // Check win condition
            if (playerHand.length === 0) {
                await handleRoundEnd(room, playerIndex, 'winner', gameEngine);
            } else {
                // Move to next player
                room.gameState.currentPlayer = (room.gameState.currentPlayer + 1) % 4;
                
                // Check if game is blocked
                if (gameEngine.isGameBlocked(room.gameState.playerHands, room.gameState.board)) {
                    const gapleCard = gameEngine.detectGaple(room.gameState.board);
                    const endType = gapleCard ? 'gaple' : 'blocked';
                    await handleRoundEnd(room, null, endType, gameEngine, gapleCard);
                } else {
                    room.updatedAt = new Date();
                    await room.save();
                    activeRooms.set(roomId, room);
                    
                    await broadcastGameUpdate(roomId, room, `${room.players[playerIndex].playerName} memainkan kartu`);
                }
            }

        } catch (error) {
            socket.emit('error', { message: 'Gagal memainkan kartu' });
            console.error('Play card error:', error);
        }
    });

    // Pass Move
    socket.on('passMove', async (data) => {
        try {
            const { roomId } = data;
            let room = await Room.findOne({ roomId });

            if (!room || !room.gameState.isStarted) {
                socket.emit('error', { message: 'Game belum dimulai' });
                return;
            }

            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== room.gameState.currentPlayer) {
                socket.emit('error', { message: 'Bukan giliran Anda' });
                return;
            }

            const gameEngine = new GapleGameEngine();
            const playerHand = room.gameState.playerHands[playerIndex];
            
            // Validate that player really can't play
            const hasPlayableCard = playerHand.some(card => 
                gameEngine.canPlayCard(card, room.gameState.board)
            );

            if (hasPlayableCard) {
                socket.emit('error', { message: 'Anda masih bisa memainkan kartu' });
                return;
            }

            // Move to next player
            room.gameState.currentPlayer = (room.gameState.currentPlayer + 1) % 4;

            // Check if all players passed (game blocked)
            if (gameEngine.isGameBlocked(room.gameState.playerHands, room.gameState.board)) {
                const gapleCard = gameEngine.detectGaple(room.gameState.board);
                const endType = gapleCard ? 'gaple' : 'blocked';
                await handleRoundEnd(room, null, endType, gameEngine, gapleCard);
            } else {
                room.updatedAt = new Date();
                await room.save();
                activeRooms.set(roomId, room);
                
                await broadcastGameUpdate(roomId, room, `${room.players[playerIndex].playerName} pass`);
            }

        } catch (error) {
            socket.emit('error', { message: 'Gagal pass' });
            console.error('Pass move error:', error);
        }
    });

    // Leave Room
    socket.on('leaveRoom', async (data) => {
        await handlePlayerLeave(socket);
    });

    // Disconnect
    socket.on('disconnect', async () => {
        console.log(`Client disconnected: ${socket.id}`);
        await handlePlayerLeave(socket);
    });

    // Helper function to handle player leave
    async function handlePlayerLeave(socket) {
        try {
            if (!socket.roomId) return;

            let room = await Room.findOne({ roomId: socket.roomId });
            if (!room) return;

            const leavingPlayer = room.players.find(p => p.socketId === socket.id);
            if (!leavingPlayer) return;

            room.players = room.players.filter(p => p.socketId !== socket.id);

            if (room.players.length === 0) {
                // Delete empty room
                await Room.deleteOne({ roomId: socket.roomId });
                activeRooms.delete(socket.roomId);
            } else {
                // Transfer host if needed
                if (leavingPlayer.isHost && room.players.length > 0) {
                    room.players[0].isHost = true;
                }

                room.updatedAt = new Date();
                await room.save();
                activeRooms.set(socket.roomId, room);

                const playersData = room.players.map(p => ({
                    playerId: p.playerId,
                    playerName: p.playerName,
                    totalScore: p.totalScore,
                    isHost: p.isHost
                }));

                io.to(socket.roomId).emit('playerLeft', {
                    players: playersData,
                    leftPlayer: {
                        playerName: leavingPlayer.playerName
                    }
                });
            }

            socket.leave(socket.roomId);
        } catch (error) {
            console.error('Handle player leave error:', error);
        }
    }

    // Handle round end
    async function handleRoundEnd(room, winnerIndex, endType, gameEngine, gapleCard = null) {
        const roundPoints = gameEngine.calculateRoundPoints(room.gameState.playerHands);
        
        // Update total scores
        room.players.forEach((player, index) => {
            player.totalScore += roundPoints[index];
        });

        room.gameState.lastWinner = winnerIndex;
        room.gameState.gapleCard = gapleCard;
        room.gameState.roundEndType = endType;
        room.gameState.roundEnded = true;

        // Check if game should end
        const maxScore = Math.max(...room.players.map(p => p.totalScore));
        if (maxScore >= room.gameState.maxPoint) {
            // Game ends
            const winner = room.players.reduce((min, player) => 
                player.totalScore < min.totalScore ? player : min
            );

            room.gameState.gameEnded = true;
            
            // Save game history
            const gameHistory = new GameHistory({
                roomId: room.roomId,
                players: room.players.map(p => p.playerName),
                winner: winner.playerName,
                finalScores: room.players.map(p => ({
                    playerName: p.playerName,
                    score: p.totalScore
                })),
                rounds: room.gameState.round,
                duration: Date.now() - room.createdAt.getTime()
            });
            await gameHistory.save();

            room.updatedAt = new Date();
            await room.save();

            io.to(room.roomId).emit('gameEnded', {
                winner: {
                    playerId: winner.playerId,
                    playerName: winner.playerName,
                    totalScore: winner.totalScore
                },
                finalScores: room.players.map(p => ({
                    playerName: p.playerName,
                    totalScore: p.totalScore
                }))
            });

        } else {
            // Start new round
            await startNewRound(room, gameEngine);
        }
    }

    // Start new round
    async function startNewRound(room, gameEngine) {
        const playerHands = gameEngine.dealCards();
        const firstPlayerInfo = gameEngine.determineFirstPlayer(
            playerHands,
            room.gameState.lastWinner,
            room.gameState.gapleCard,
            room.gameState.roundEndType
        );

        room.gameState.round += 1;
        room.gameState.currentPlayer = firstPlayerInfo.playerIndex;
        room.gameState.board = [];
        room.gameState.playerHands = playerHands;
        room.gameState.roundEnded = false;
        room.gameState.currentRoundFirstPlayerType = firstPlayerInfo.type;

        room.updatedAt = new Date();
        await room.save();
        activeRooms.set(room.roomId, room);

        // Notify players of new round
        const gameData = {
            gameState: {
                currentPlayer: room.gameState.currentPlayer,
                round: room.gameState.round,
                maxPoint: room.gameState.maxPoint,
                board: room.gameState.board,
                currentTurn: room.players[room.gameState.currentPlayer].playerName,
                firstPlayerType: firstPlayerInfo.type,
                requiredCard: firstPlayerInfo.requiredCard
            },
            players: room.players.map(p => ({
                playerId: p.playerId,
                playerName: p.playerName,
                totalScore: p.totalScore
            }))
        };

        room.players.forEach((player, index) => {
            const playerSocket = io.sockets.sockets.get(player.socketId);
            if (playerSocket) {
                playerSocket.emit('newRoundStarted', {
                    ...gameData,
                    myPlayerIndex: index,
                    myCards: room.gameState.playerHands[index]
                });
            }
        });
    }

    // Broadcast game update to all players in room
    async function broadcastGameUpdate(roomId, room, message = '') {
        const gameData = {
            gameState: {
                currentPlayer: room.gameState.currentPlayer,
                round: room.gameState.round,
                maxPoint: room.gameState.maxPoint,
                board: room.gameState.board,
                currentTurn: room.players[room.gameState.currentPlayer].playerName,
                roundEnded: room.gameState.roundEnded,
                gameEnded: room.gameState.gameEnded
            },
            players: room.players.map(p => ({
                playerId: p.playerId,
                playerName: p.playerName,
                totalScore: p.totalScore
            })),
            message
        };

        room.players.forEach((player, index) => {
            const playerSocket = io.sockets.sockets.get(player.socketId);
            if (playerSocket) {
                playerSocket.emit('gameUpdate', {
                    ...gameData,
                    myPlayerIndex: index,
                    myCards: room.gameState.playerHands[index],
                    otherPlayersCardCount: room.gameState.playerHands.map((hand, i) => 
                        i === index ? hand.length : hand.length
                    )
                });
            }
        });
    }
});

// Utility functions
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substring(2, 12);
}

// Cleanup inactive rooms every 30 minutes
setInterval(async () => {
    try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const inactiveRooms = await Room.find({
            updatedAt: { $lt: thirtyMinutesAgo },
            'gameState.isStarted': false
        });

        for (const room of inactiveRooms) {
            activeRooms.delete(room.roomId);
            await Room.deleteOne({ _id: room._id });
        }

        console.log(`Cleaned up ${inactiveRooms.length} inactive rooms`);
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}, 30 * 60 * 1000);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        activeRooms: activeRooms.size,
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Gaple Game Server running on port ${PORT}`);
    console.log(`MongoDB connected to gaple-game database`);
});