// client-socket-integration.js
// Tambahkan script ini ke HTML file yang sudah ada

// Socket.IO Connection
let socket = null;

// Initialize Socket Connection
function initializeSocket() {
    socket = io('http://localhost:3000'); // Ganti dengan URL server Anda
    
    // Connection events
    socket.on('connect', () => {
        console.log('Connected to server:', socket.id);
        showMessage('Terhubung ke server', 'success');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showMessage('Terputus dari server', 'error');
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showMessage('Gagal terhubung ke server', 'error');
    });

    // Room events
    socket.on('roomCreated', (data) => {
        gameState.roomId = data.roomId;
        gameState.playerId = data.playerId;
        gameState.players = data.players;
        gameState.isRoomHost = true;
        
        document.getElementById('displayRoomId').textContent = data.roomId;
        document.getElementById('roomLink').value = `${window.location.origin}?room=${data.roomId}`;
        
        updatePlayersDisplay();
        showScreen('room');
        showMessage('Room berhasil dibuat!', 'success');
    });
    
    socket.on('roomJoined', (data) => {
        gameState.roomId = data.roomId;
        gameState.playerId = data.playerId;
        gameState.players = data.players;
        
        document.getElementById('displayRoomId').textContent = data.roomId;
        document.getElementById('roomLink').value = `${window.location.origin}?room=${data.roomId}`;
        
        updatePlayersDisplay();
        showScreen('room');
        showMessage('Berhasil join room!', 'success');
    });
    
    socket.on('playerJoined', (data) => {
        gameState.players = data.players;
        updatePlayersDisplay();
        showMessage(`${data.newPlayer.playerName} bergabung`, 'info');
    });
    
    socket.on('playerLeft', (data) => {
        gameState.players = data.players;
        updatePlayersDisplay();
        showMessage(`${data.leftPlayer.playerName} keluar`, 'info');
        
        // Update host status if needed
        const myPlayer = gameState.players.find(p => p.playerId === gameState.playerId);
        if (myPlayer) {
            gameState.isRoomHost = myPlayer.isHost;
            updatePlayersDisplay();
        }
    });

    // Game events
    socket.on('gameStarted', (data) => {
        gameState.gameData = data.gameState;
        gameState.myPlayerIndex = data.myPlayerIndex;
        gameState.players = data.players;
        
        // Update my cards
        gameState.gameData.myCards = data.myCards;
        
        updateGameDisplay();
        showScreen('game');
        showMessage('Game dimulai!', 'success');
        
        // Show opening card instruction if it's my turn
        if (data.myPlayerIndex === data.gameState.currentPlayer) {
            showOpeningCardInstruction(data.gameState.firstPlayerType, data.gameState.requiredCard);
        }
    });
    
    socket.on('gameUpdate', (data) => {
        gameState.gameData = data.gameState;
        gameState.players = data.players;
        gameState.gameData.myCards = data.myCards;
        gameState.gameData.otherPlayersCardCount = data.otherPlayersCardCount;
        
        updateGameDisplay();
        
        if (data.message) {
            showMessage(data.message, 'info');
        }
    });
    
    socket.on('newRoundStarted', (data) => {
        gameState.gameData = data.gameState;
        gameState.players = data.players;
        gameState.gameData.myCards = data.myCards;
        
        updateGameDisplay();
        showMessage(`Round ${data.gameState.round} dimulai!`, 'success');
        
        // Show opening card instruction if it's my turn
        if (data.myPlayerIndex === data.gameState.currentPlayer) {
            showOpeningCardInstruction(data.gameState.firstPlayerType, data.gameState.requiredCard);
        }
    });
    
    socket.on('gameEnded', (data) => {
        showMessage(`🎉 Game Selesai! Pemenang: ${data.winner.playerName} 🎉`, 'success');
        showWinnerAnimation(data.winner.playerName);
        
        // Show final scores
        showFinalScores(data.finalScores);
        
        // Show play again option after 3 seconds
        setTimeout(() => {
            if (confirm('Game selesai! Ingin bermain lagi?')) {
                // Reset game state but keep room
                gameState.gameData = null;
                showScreen('room');
            } else {
                leaveRoom();
            }
        }, 3000);
    });

    // Error events
    socket.on('error', (data) => {
        showMessage(data.message, 'error');
    });
    
    socket.on('roomNotFound', () => {
        showMessage('Room tidak ditemukan!', 'error');
    });
    
    socket.on('roomFull', () => {
        showMessage('Room sudah penuh!', 'error');
    });
}

// Updated Room Management Functions
function createRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        showMessage('Masukkan nama pemain terlebih dahulu!', 'error');
        return;
    }
    
    if (!socket) {
        initializeSocket();
    }
    
    gameState.playerName = playerName;
    socket.emit('createRoom', { playerName });
}

function joinRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    const roomId = document.getElementById('roomId').value.trim().toUpperCase();
    
    if (!playerName || !roomId) {
        showMessage('Masukkan nama pemain dan Room ID!', 'error');
        return;
    }
    
    if (!socket) {
        initializeSocket();
    }
    
    gameState.playerName = playerName;
    socket.emit('joinRoom', { roomId, playerName });
}

function leaveRoom() {
    if (socket && gameState.roomId) {
        socket.emit('leaveRoom', { roomId: gameState.roomId });
    }
    
    // Reset game state
    gameState = {
        currentScreen: 'home',
        playerName: '',
        roomId: '',
        playerId: '',
        players: [],
        isRoomHost: false,
        gameData: null,
        selectedCard: null,
        selectedPosition: null,
        myPlayerIndex: -1
    };
    
    showScreen('home');
    showMessage('Keluar dari room', 'info');
}

function startGame() {
    if (!gameState.isRoomHost) {
        showMessage('Hanya host yang bisa memulai game!', 'error');
        return;
    }
    
    if (gameState.players.length !== 4) {
        showMessage('Butuh 4 pemain untuk memulai game!', 'error');
        return;
    }
    
    socket.emit('startGame', { roomId: gameState.roomId });
}

// Updated Card Playing Functions
function playSelectedCard() {
    if (gameState.selectedCard === null || !gameState.selectedPosition) {
        showMessage('Pilih kartu dan posisi!', 'error');
        return;
    }
    
    socket.emit('playCard', {
        roomId: gameState.roomId,
        cardIndex: gameState.selectedCard,
        position: gameState.selectedPosition
    });
    
    cancelSelection();
}

function passMove() {
    socket.emit('passMove', { roomId: gameState.roomId });
}

// Helper Functions
function showOpeningCardInstruction(firstPlayerType, requiredCard) {
    let instruction = '';
    
    switch (firstPlayerType) {
        case 'double_zero':
            instruction = 'Mainkan kartu 0-0 untuk memulai round';
            break;
        case 'winner':
            instruction = 'Mainkan kartu balak (kembar) jika ada, atau kartu bebas';
            break;
        case 'gaple':
            if (requiredCard) {
                instruction = `Mainkan kartu gaple ${requiredCard.left}-${requiredCard.right}`;
            }
            break;
        case 'fallback':
            if (requiredCard) {
                instruction = `Mainkan kartu ${requiredCard.left}-${requiredCard.right}`;
            }
            break;
    }
    
    if (instruction) {
        showMessage(instruction, 'info');
    }
}

function showFinalScores(finalScores) {
    const scoresMessage = finalScores
        .sort((a, b) => a.score - b.score)
        .map((score, index) => `${index + 1}. ${score.playerName}: ${score.score} pts`)
        .join('\n');
    
    setTimeout(() => {
        alert('Final Scores:\n' + scoresMessage);
    }, 1000);
}

function updatePlayersDisplay() {
    const slots = document.querySelectorAll('.player-slot');
    
    slots.forEach((slot, index) => {
        if (gameState.players[index]) {
            slot.classList.add('filled');
            const player = gameState.players[index];
            slot.querySelector('.player-name').textContent = player.playerName;
            
            // Mark current user and host
            if (player.playerId === gameState.playerId) {
                slot.classList.add('current');
            }
            if (player.isHost) {
                slot.querySelector('.player-name').textContent += ' 👑';
            }
        } else {
            slot.classList.remove('filled', 'current');
            slot.querySelector('.player-name').textContent = 'Menunggu...';
        }
    });
    
    // Show start button if room is full and user is host
    const startBtn = document.getElementById('startGameBtn');
    if (gameState.players.length === 4 && gameState.isRoomHost) {
        startBtn.classList.remove('hidden');
    } else {
        startBtn.classList.add('hidden');
    }
}

function updateOtherPlayersDisplay() {
    gameState.players.forEach((player, index) => {
        if (index === gameState.myPlayerIndex) return;
        
        const playerHand = document.getElementById(`player${index + 1}Hand`);
        if (!playerHand) return;
        
        const nameElement = playerHand.querySelector('.player-name span:first-child');
        const scoreElement = playerHand.querySelector('.player-score');
        const cardsContainer = playerHand.querySelector('.hand-cards');
        
        nameElement.textContent = player.playerName;
        scoreElement.textContent = `${player.totalScore} pts`;
        
        // Show card backs for other players
        cardsContainer.innerHTML = '';
        const cardCount = gameState.gameData.otherPlayersCardCount 
            ? gameState.gameData.otherPlayersCardCount[index] 
            : 7;
            
        for (let i = 0; i < cardCount; i++) {
            const cardBack = document.createElement('div');
            cardBack.className = 'domino';
            cardBack.style.background = '#333';
            cardBack.style.color = 'white';
            cardBack.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 12px;">🂠</div>';
            cardsContainer.appendChild(cardBack);
        }
        
        // Highlight current player
        if (index === gameState.gameData.currentPlayer) {
            playerHand.classList.add('current-player');
        } else {
            playerHand.classList.remove('current-player');
        }
    });
}

// Initialize socket when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check if room ID is in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    
    if (roomFromUrl) {
        document.getElementById('roomId').value = roomFromUrl;
    }
    
    // Focus on player name input
    document.getElementById('playerName').focus();
    
    // Add enter key listeners
    document.getElementById('playerName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            createRoom();
        }
    });
    
    document.getElementById('roomId').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinRoom();
        }
    });
    
    // Initialize socket connection
    initializeSocket();
});

// Handle page visibility change (reconnect if needed)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && socket && !socket.connected) {
        console.log('Page became visible, checking connection...');
        socket.connect();
    }
});

// Handle browser refresh/close
window.addEventListener('beforeunload', function() {
    if (socket && gameState.roomId) {
        socket.emit('leaveRoom', { roomId: gameState.roomId });
    }
});