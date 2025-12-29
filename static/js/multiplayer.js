// ================ VARIABLES GLOBALES ================
let socket;
let gameState = {
    roomCode: null,
    playerName: '',
    avatar: '😀',
    isHost: false,
    players: [],
    currentQuestion: null,
    questionNumber: 0,
    totalQuestions: 0,
    timer: 30,
    timerInterval: null,
    hasAnswered: false
};

// ================ INITIALISATION ================
document.addEventListener('DOMContentLoaded', function() {
    initSocketIO();
    initThemeToggle();
    setupEventListeners();
    
    // Charger le nom sauvegardé
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
        document.getElementById('playerNameInput').value = savedName;
    }
});

// ================ SOCKET.IO ================
function initSocketIO() {
    socket = io();
    
    socket.on('connected', (data) => {
        console.log('Connecté au serveur:', data.sid);
    });
    
    socket.on('room_created', handleRoomCreated);
    socket.on('room_joined', handleRoomJoined);
    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_left', handlePlayerLeft);
    socket.on('player_ready_update', handlePlayerReadyUpdate);
    socket.on('all_players_ready', handleAllPlayersReady);
    socket.on('game_started', handleGameStarted);
    socket.on('new_question', handleNewQuestion);
    socket.on('player_answered', handlePlayerAnswered);
    socket.on('question_results', handleQuestionResults);
    socket.on('game_ended', handleGameEnded);
    socket.on('chat_message', handleChatMessage);
    socket.on('new_host', handleNewHost);
    socket.on('error', handleError);
}

// ================ EVENT LISTENERS ================
function setupEventListeners() {
    // Créer une salle
    document.getElementById('createRoomBtn').addEventListener('click', createRoom);
    
    // Rejoindre une salle
    document.getElementById('joinRoomBtn').addEventListener('click', joinRoom);
    document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoom();
    });
    
    // Quitter la salle
    document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);
    
    // Prêt
    document.getElementById('readyBtn').addEventListener('click', setReady);
    
    // Démarrer
    document.getElementById('startGameBtn').addEventListener('click', startGame);
    
    // Chat
    document.getElementById('sendChatBtn').addEventListener('click', sendChatMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    // Rejouer
    document.getElementById('playAgainBtn').addEventListener('click', () => {
        window.location.reload();
    });
}

// ================ FONCTIONS PRINCIPALES ================

function createRoom() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) {
        alert('Veuillez entrer votre nom');
        return;
    }
    
    gameState.playerName = playerName;
    gameState.avatar = document.getElementById('avatarSelect').value;
    localStorage.setItem('playerName', playerName);
    
    const category = document.getElementById('categorySelect').value;
    const questionsCount = parseInt(document.getElementById('questionsCountSelect').value);
    const maxPlayers = parseInt(document.getElementById('maxPlayersSelect').value);
    
    socket.emit('create_room', {
        player_name: playerName,
        avatar: gameState.avatar,
        category: category,
        questions_count: questionsCount,
        max_players: maxPlayers
    });
}

function joinRoom() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    
    if (!playerName) {
        alert('Veuillez entrer votre nom');
        return;
    }
    
    if (!roomCode || roomCode.length !== 6) {
        alert('Code de salle invalide');
        return;
    }
    
    gameState.playerName = playerName;
    gameState.avatar = document.getElementById('avatarSelect').value;
    localStorage.setItem('playerName', playerName);
    
    socket.emit('join_room', {
        room_code: roomCode,
        player_name: playerName,
        avatar: gameState.avatar
    });
}

function leaveRoom() {
    if (confirm('Êtes-vous sûr de vouloir quitter la salle ?')) {
        socket.emit('leave_room', {
            room_code: gameState.roomCode
        });
        showScreen('menuScreen');
        gameState.roomCode = null;
    }
}

function setReady() {
    socket.emit('player_ready', {
        room_code: gameState.roomCode
    });
    
    document.getElementById('readyBtn').disabled = true;
    document.getElementById('readyBtn').innerHTML = '<i class="fas fa-check me-2"></i>Prêt !';
}

function startGame() {
    socket.emit('start_game', {
        room_code: gameState.roomCode
    });
}

function submitAnswer(answerIndex) {
    if (gameState.hasAnswered) return;
    
    gameState.hasAnswered = true;
    const timeTaken = 30 - gameState.timer;
    
    // Désactiver les boutons
    document.querySelectorAll('.choice-btn').forEach(btn => btn.disabled = true);
    
    socket.emit('submit_answer', {
        room_code: gameState.roomCode,
        answer: answerIndex,
        time_taken: timeTaken
    });
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    socket.emit('chat_message', {
        room_code: gameState.roomCode,
        message: message
    });
    
    input.value = '';
}

// ================ HANDLERS SOCKET ================

function handleRoomCreated(data) {
    gameState.roomCode = data.room_code;
    gameState.isHost = true;
    gameState.players = data.room.players;
    
    document.getElementById('roomCodeDisplay').textContent = data.room_code;
    document.getElementById('maxPlayers').textContent = data.room.max_players;
    
    showScreen('lobbyScreen');
    updatePlayersList();
    
    // L'hôte peut démarrer
    document.getElementById('startGameBtn').style.display = 'inline-block';
}

function handleRoomJoined(data) {
    gameState.roomCode = data.room_code;
    gameState.isHost = false;
    gameState.players = data.room.players;
    
    document.getElementById('roomCodeDisplay').textContent = data.room_code;
    document.getElementById('maxPlayers').textContent = data.room.max_players;
    
    showScreen('lobbyScreen');
    updatePlayersList();
}

function handlePlayerJoined(data) {
    gameState.players = data.players;
    updatePlayersList();
    
    addChatMessage('Système', `Un joueur a rejoint la salle (${data.players_count} joueurs)`);
}

function handlePlayerLeft(data) {
    gameState.players = data.players;
    updatePlayersList();
    
    addChatMessage('Système', `Un joueur a quitté la salle (${data.players_count} joueurs)`);
}

function handlePlayerReadyUpdate(data) {
    gameState.players = data.players;
    updatePlayersList();
}

function handleAllPlayersReady() {
    document.getElementById('lobbyInfo').innerHTML = 
        '<i class="fas fa-check-circle me-2"></i>Tous les joueurs sont prêts ! L\'hôte peut démarrer.';
}

function handleGameStarted(data) {
    gameState.totalQuestions = data.total_questions;
    gameState.questionNumber = 0;
    
    showScreen('gameScreen');
    addChatMessage('Système', 'La partie commence !');
}

function handleNewQuestion(data) {
    gameState.currentQuestion = data.question;
    gameState.questionNumber = data.question_number;
    gameState.hasAnswered = false;
    
    // Mettre à jour l'affichage
    document.getElementById('currentQuestionNum').textContent = data.question_number;
    document.getElementById('totalQuestionsNum').textContent = data.total_questions;
    document.getElementById('gameQuestionText').textContent = data.question.question;
    document.getElementById('totalPlayersCount').textContent = gameState.players.length;
    document.getElementById('answeredCount').textContent = '0';
    
    // Progression
    const progress = (data.question_number / data.total_questions) * 100;
    document.getElementById('gameProgress').style.width = `${progress}%`;
    
    // Afficher les choix
    const choicesContainer = document.getElementById('gameChoices');
    choicesContainer.innerHTML = '';
    
    data.question.choices.forEach((choice, index) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerHTML = `
            <span class="choice-letter">${String.fromCharCode(65 + index)}</span>
            <span class="choice-text">${choice}</span>
        `;
        btn.onclick = () => submitAnswer(index);
        choicesContainer.appendChild(btn);
    });
    
    // Démarrer le timer
    startQuestionTimer();
    updateScoreboard();
}

function handlePlayerAnswered(data) {
    document.getElementById('answeredCount').textContent = data.answered_count;
}

function handleQuestionResults(data) {
    stopQuestionTimer();
    
    // Mettre à jour les scores
    gameState.players = data.players;
    updateScoreboard();
    
    // Afficher la bonne réponse
    const buttons = document.querySelectorAll('.choice-btn');
    buttons[data.correct_answer].classList.add('correct');
    
    // Afficher l'explication
    addChatMessage('Système', `✅ ${data.explanation}`);
}

function handleGameEnded(data) {
    gameState.players = data.players;
    showScreen('resultsScreen');
    
    displayResults(data.players);
    
    // Confetti pour le gagnant
    if (data.players[0].sid === socket.id) {
        launchConfetti();
    }
}

function handleChatMessage(data) {
    addChatMessage(data.player_name, data.message);
}

function handleNewHost(data) {
    if (data.host_sid === socket.id) {
        gameState.isHost = true;
        document.getElementById('startGameBtn').style.display = 'inline-block';
        addChatMessage('Système', 'Vous êtes maintenant l\'hôte de la salle');
    }
}

function handleError(data) {
    alert(data.message);
}

// ================ AFFICHAGE ================

function showScreen(screenId) {
    ['menuScreen', 'lobbyScreen', 'gameScreen', 'resultsScreen'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    document.getElementById(screenId).style.display = 'block';
}

function updatePlayersList() {
    const container = document.getElementById('playersList');
    container.innerHTML = '';
    
    document.getElementById('playersCount').textContent = gameState.players.length;
    
    gameState.players.forEach((player, index) => {
        const playerCard = document.createElement('div');
        playerCard.className = 'col-md-6';
        playerCard.innerHTML = `
            <div class="player-card ${player.ready ? 'ready' : ''}">
                <div class="d-flex align-items-center">
                    <div class="player-avatar me-3">${player.avatar}</div>
                    <div class="flex-grow-1">
                        <div class="player-name">${player.name}</div>
                        <div class="player-status">
                            ${player.ready ? 
                                '<span class="badge bg-success">Prêt</span>' : 
                                '<span class="badge bg-secondary">En attente</span>'}
                        </div>
                    </div>
                    ${player.sid === socket.id ? '<i class="fas fa-user-check text-primary"></i>' : ''}
                </div>
            </div>
        `;
        container.appendChild(playerCard);
    });
}

function updateScoreboard() {
    const container = document.getElementById('gameScoreboard');
    container.innerHTML = '';
    
    // Trier par score
    const sorted = [...gameState.players].sort((a, b) => b.score - a.score);
    
    sorted.forEach((player, index) => {
        const col = document.createElement('div');
        col.className = 'col-md-3 col-6';
        col.innerHTML = `
            <div class="scoreboard-item ${player.sid === socket.id ? 'current-player' : ''}">
                <div class="rank">#${index + 1}</div>
                <div class="avatar">${player.avatar}</div>
                <div class="name">${player.name}</div>
                <div class="score">${player.score}</div>
            </div>
        `;
        container.appendChild(col);
    });
}

function displayResults(players) {
    const podiumContainer = document.getElementById('podium');
    const rankingContainer = document.getElementById('finalRanking');
    
    podiumContainer.innerHTML = '';
    rankingContainer.innerHTML = '';
    
    // Podium (top 3)
    const podiumPlaces = [1, 0, 2]; // 2ème, 1er, 3ème
    const medals = ['🥈', '🥇', '🥉'];
    const colors = ['silver', 'gold', 'bronze'];
    
    podiumPlaces.forEach((index, i) => {
        if (players[index]) {
            const col = document.createElement('div');
            col.className = 'col-4';
            col.innerHTML = `
                <div class="podium-place ${colors[i]}">
                    <div class="medal">${medals[i]}</div>
                    <div class="avatar">${players[index].avatar}</div>
                    <div class="name">${players[index].name}</div>
                    <div class="score">${players[index].score} pts</div>
                </div>
            `;
            podiumContainer.appendChild(col);
        }
    });
    
    // Classement complet
    players.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = `ranking-item ${player.sid === socket.id ? 'current-player' : ''}`;
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center p-3">
                <div class="d-flex align-items-center">
                    <div class="rank me-3">#${index + 1}</div>
                    <div class="avatar me-3">${player.avatar}</div>
                    <div class="name">${player.name}</div>
                </div>
                <div class="score">${player.score} pts</div>
            </div>
        `;
        rankingContainer.appendChild(item);
    });
}

function addChatMessage(playerName, message) {
    const container = document.getElementById('chatMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message mb-2 p-2';
    msgDiv.innerHTML = `
        <strong>${playerName}:</strong> ${message}
    `;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// ================ TIMER ================

function startQuestionTimer() {
    gameState.timer = 30;
    updateTimerDisplay();
    
    gameState.timerInterval = setInterval(() => {
        gameState.timer--;
        updateTimerDisplay();
        
        if (gameState.timer <= 0) {
            stopQuestionTimer();
            if (!gameState.hasAnswered) {
                submitAnswer(-1); // Réponse vide
            }
        }
    }, 1000);
}

function stopQuestionTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function updateTimerDisplay() {
    const timerEl = document.getElementById('gameTimer');
    timerEl.textContent = `${gameState.timer}s`;
    
    if (gameState.timer <= 5) {
        timerEl.className = 'badge bg-danger';
    } else if (gameState.timer <= 10) {
        timerEl.className = 'badge bg-warning';
    } else {
        timerEl.className = 'badge bg-primary';
    }
}

// ================ CONFETTI ================

function launchConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    
    const particles = [];
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffd93d', '#6bcf7f'];
    
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            radius: Math.random() * 6 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: Math.random() * 2 - 1,
            vy: Math.random() * 5 + 2
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach((p, index) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            
            if (p.y > canvas.height) {
                particles.splice(index, 1);
            }
        });
        
        if (particles.length > 0) {
            requestAnimationFrame(animate);
        } else {
            canvas.style.display = 'none';
        }
    }
    
    animate();
}

// ================ THÈME ================

function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        this.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
}