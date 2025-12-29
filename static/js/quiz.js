// Variables globales du jeu
let gameState = {
    mode: 'solo',
    category: '',
    categoryName: '',
    playerName: '',
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    correctAnswers: 0,
    lives: 3,
    streak: 0,
    maxStreak: 0,
    timeLeft: 30,
    timerInterval: null,
    questionStartTime: null,
    totalTime: 0,
    answeredQuestions: []
};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    loadGameSettings();
    loadQuestions();
    initThemeToggle();
    initSounds();
});

// Charger les paramètres du jeu
function loadGameSettings() {
    gameState.mode = localStorage.getItem('quizMode') || 'solo';
    gameState.category = localStorage.getItem('quizCategory');
    gameState.playerName = localStorage.getItem('playerName') || 'Anonyme';

    if (!gameState.category) {
        window.location.href = '/';
        return;
    }

    // Configurer les vies selon le mode
    if (gameState.mode === 'hardcore') {
        gameState.lives = 1;
    }

    updateLivesDisplay();
}

// Charger les questions
async function loadQuestions() {
    try {
        const response = await fetch(`/api/questions/${gameState.category}`);
        const allQuestions = await response.json();
        
        // Mélanger et prendre 40 questions (ou toutes si moins de 40)
        gameState.questions = shuffleArray(allQuestions).slice(0, 40);
        
        document.getElementById('totalQuestions').textContent = gameState.questions.length;
        
        displayQuestion();
    } catch (error) {
        console.error('Erreur chargement questions:', error);
        alert('Erreur lors du chargement des questions');
        window.location.href = '/';
    }
}

// Afficher la question actuelle
function displayQuestion() {
    const question = gameState.questions[gameState.currentQuestionIndex];
    
    // Mise à jour du compteur
    document.getElementById('currentQuestion').textContent = gameState.currentQuestionIndex + 1;
    
    // Mise à jour de la barre de progression
    const progress = ((gameState.currentQuestionIndex + 1) / gameState.questions.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
    
    // Afficher la difficulté
    const difficultyBadge = document.getElementById('difficultyBadge');
    const difficultyNames = ['Facile', 'Moyen', 'Difficile'];
    const difficultyColors = ['success', 'warning', 'danger'];
    difficultyBadge.innerHTML = `<span class="badge bg-${difficultyColors[question.difficulty - 1]}">${difficultyNames[question.difficulty - 1]}</span>`;
    
    // Afficher la question
    document.getElementById('questionText').textContent = question.question;
    
    // Afficher les choix
    const choicesContainer = document.getElementById('choicesContainer');
    choicesContainer.innerHTML = '';
    
    question.choices.forEach((choice, index) => {
        const choiceBtn = document.createElement('button');
        choiceBtn.className = 'choice-btn';
        choiceBtn.innerHTML = `
            <span class="choice-letter">${String.fromCharCode(65 + index)}</span>
            <span class="choice-text">${choice}</span>
        `;
        choiceBtn.onclick = () => selectAnswer(index);
        choicesContainer.appendChild(choiceBtn);
    });
    
    // Réinitialiser et démarrer le timer
    resetTimer();
    startTimer();
    gameState.questionStartTime = Date.now();
}

// Timer
function startTimer() {
    gameState.timeLeft = 30;
    updateTimerDisplay();
    
    gameState.timerInterval = setInterval(() => {
        gameState.timeLeft--;
        updateTimerDisplay();
        
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timerInterval);
            handleTimeout();
        }
    }, 1000);
}

function resetTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
}

function updateTimerDisplay() {
    const timerText = document.getElementById('timerText');
    const timerCircle = document.getElementById('timerCircle');
    
    timerText.textContent = gameState.timeLeft;
    
    // Calculer le pourcentage pour l'animation SVG
    const percentage = (gameState.timeLeft / 30) * 283; // 283 est la circonférence
    timerCircle.style.strokeDashoffset = 283 - percentage;
    
    // Changer la couleur si temps faible
    if (gameState.timeLeft <= 5) {
        timerCircle.classList.add('timer-danger');
    } else {
        timerCircle.classList.remove('timer-danger');
    }
}

// Gestion des réponses
function selectAnswer(selectedIndex) {
    resetTimer();
    
    const question = gameState.questions[gameState.currentQuestionIndex];
    const isCorrect = selectedIndex === question.correct;
    const responseTime = (Date.now() - gameState.questionStartTime) / 1000;
    
    // Enregistrer la réponse
    gameState.answeredQuestions.push({
        question: question.question,
        selected: selectedIndex,
        correct: question.correct,
        isCorrect: isCorrect,
        timeSpent: responseTime
    });
    
    // Désactiver tous les boutons
    document.querySelectorAll('.choice-btn').forEach(btn => {
        btn.disabled = true;
    });
    
    // Afficher la bonne/mauvaise réponse visuellement
    const buttons = document.querySelectorAll('.choice-btn');
    buttons[question.correct].classList.add('correct');
    
    if (!isCorrect) {
        buttons[selectedIndex].classList.add('wrong');
        playSound('wrong');
        
        // Perdre une vie
        gameState.lives--;
        gameState.streak = 0;
        updateLivesDisplay();
        
        // Vérifier si game over
        if (gameState.lives <= 0) {
            setTimeout(() => {
                gameOver();
            }, 2000);
            return;
        }
    } else {
        playSound('correct');
        gameState.correctAnswers++;
        gameState.streak++;
        
        if (gameState.streak > gameState.maxStreak) {
            gameState.maxStreak = gameState.streak;
        }
        
        // Calculer les points
        const points = calculatePoints(question.difficulty, responseTime);
        gameState.score += points;
        
        // Animation des points
        animateScore(points);
    }
    
    gameState.totalTime += responseTime;
    updateStats();
    
    // Afficher l'explication
    showExplanation(isCorrect, question.explanation, calculatePoints(question.difficulty, responseTime));
}

function calculatePoints(difficulty, responseTime) {
    let basePoints = 100;
    
    // Bonus de difficulté
    basePoints += (difficulty - 1) * 50;
    
    // Bonus de rapidité (plus rapide = plus de points)
    const speedBonus = Math.max(0, Math.floor((30 - responseTime) * 2));
    basePoints += speedBonus;
    
    // Bonus de série
    const streakBonus = gameState.streak >= 3 ? gameState.streak * 10 : 0;
    basePoints += streakBonus;
    
    // Mode hardcore x2
    if (gameState.mode === 'hardcore') {
        basePoints *= 2;
    }
    
    return basePoints;
}

function animateScore(points) {
    const scoreDisplay = document.getElementById('scoreDisplay');
    const originalText = scoreDisplay.textContent;
    
    scoreDisplay.textContent = `+${points}`;
    scoreDisplay.classList.add('score-pulse');
    
    setTimeout(() => {
        scoreDisplay.textContent = gameState.score;
        scoreDisplay.classList.remove('score-pulse');
    }, 1000);
}

// Afficher l'explication
function showExplanation(isCorrect, explanation, points) {
    const explanationCard = document.getElementById('explanationCard');
    const questionCard = document.getElementById('questionCard');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const explanationText = document.getElementById('explanationText');
    const pointsEarned = document.getElementById('pointsEarned');
    
    // Cacher la question
    questionCard.style.display = 'none';
    
    // Configurer l'explication
    if (isCorrect) {
        resultIcon.innerHTML = '<i class="fas fa-check-circle text-success"></i>';
        resultTitle.innerHTML = '<span class="text-success">Bonne réponse !</span>';
        pointsEarned.innerHTML = `<i class="fas fa-star text-warning"></i> +${points} points`;
    } else {
        resultIcon.innerHTML = '<i class="fas fa-times-circle text-danger"></i>';
        resultTitle.innerHTML = '<span class="text-danger">Mauvaise réponse</span>';
        pointsEarned.innerHTML = '';
    }
    
    explanationText.textContent = explanation;
    
    // Afficher l'explication
    explanationCard.style.display = 'block';
    explanationCard.classList.add('animate-slide-up');
    
    // Bouton suivant
    document.getElementById('nextBtn').onclick = nextQuestion;
}

// Question suivante
function nextQuestion() {
    const explanationCard = document.getElementById('explanationCard');
    const questionCard = document.getElementById('questionCard');
    
    explanationCard.style.display = 'none';
    questionCard.style.display = 'block';
    
    gameState.currentQuestionIndex++;
    
    // Vérifier si c'est la dernière question
    if (gameState.currentQuestionIndex >= gameState.questions.length) {
        gameOver();
    } else {
        displayQuestion();
    }
}

// Timeout
function handleTimeout() {
    playSound('wrong');
    gameState.lives--;
    gameState.streak = 0;
    updateLivesDisplay();
    
    const question = gameState.questions[gameState.currentQuestionIndex];
    
    gameState.answeredQuestions.push({
        question: question.question,
        selected: -1,
        correct: question.correct,
        isCorrect: false,
        timeSpent: 30
    });
    
    gameState.totalTime += 30;
    
    // Afficher la bonne réponse
    const buttons = document.querySelectorAll('.choice-btn');
    buttons.forEach(btn => btn.disabled = true);
    buttons[question.correct].classList.add('correct');
    
    if (gameState.lives <= 0) {
        setTimeout(() => {
            gameOver();
        }, 2000);
    } else {
        showExplanation(false, `Temps écoulé ! ${question.explanation}`, 0);
    }
}

// Mettre à jour l'affichage des statistiques
function updateStats() {
    document.getElementById('scoreDisplay').textContent = gameState.score;
    document.getElementById('correctDisplay').textContent = gameState.correctAnswers;
    document.getElementById('streakDisplay').textContent = gameState.streak;
}

// Mettre à jour l'affichage des vies
function updateLivesDisplay() {
    const livesDisplay = document.getElementById('livesDisplay');
    livesDisplay.innerHTML = '';
    
    for (let i = 0; i < (gameState.mode === 'hardcore' ? 1 : 3); i++) {
        const heart = document.createElement('span');
        heart.className = 'life-heart';
        heart.innerHTML = i < gameState.lives ? '❤️' : '💔';
        livesDisplay.appendChild(heart);
    }
}

// Game Over
function gameOver() {
    resetTimer();
    
    const modal = new bootstrap.Modal(document.getElementById('gameOverModal'));
    const avgTime = gameState.totalTime / gameState.answeredQuestions.length;
    
    // Déterminer si victoire ou défaite
    const isVictory = gameState.currentQuestionIndex >= gameState.questions.length;
    
    if (isVictory) {
        document.getElementById('gameOverIcon').textContent = '🎉';
        document.getElementById('gameOverTitle').textContent = 'Félicitations !';
        launchConfetti();
    } else {
        document.getElementById('gameOverIcon').textContent = '😢';
        document.getElementById('gameOverTitle').textContent = 'Game Over';
    }
    
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('finalCorrect').textContent = `${gameState.correctAnswers}/${gameState.answeredQuestions.length}`;
    document.getElementById('finalStreak').textContent = gameState.maxStreak;
    document.getElementById('avgTime').textContent = avgTime.toFixed(1);
    
    // Sauvegarder le score
    saveScore();
    
    modal.show();
    
    // Boutons
    document.getElementById('restartBtn').onclick = () => {
        window.location.reload();
    };
    
    document.getElementById('shareBtn').onclick = shareScore;
}

// Sauvegarder le score
function saveScore() {
    const scoreData = {
        playerName: gameState.playerName,
        category: gameState.category,
        mode: gameState.mode,
        score: gameState.score,
        correctAnswers: gameState.correctAnswers,
        totalQuestions: gameState.answeredQuestions.length,
        maxStreak: gameState.maxStreak,
        avgTime: (gameState.totalTime / gameState.answeredQuestions.length).toFixed(1),
        date: new Date().toISOString()
    };
    
    // Sauvegarder dans localStorage
    let scores = JSON.parse(localStorage.getItem('quizScores') || '[]');
    scores.push(scoreData);
    localStorage.setItem('quizScores', JSON.stringify(scores));
    
    // Optionnel: envoyer au serveur
    fetch('/api/save-score', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(scoreData)
    }).catch(err => console.log('Erreur sauvegarde serveur:', err));
}

// Partager le score
function shareScore() {
    const text = `🎯 Quiz Master - Score: ${gameState.score} pts\n✅ ${gameState.correctAnswers}/${gameState.answeredQuestions.length} bonnes réponses\n🔥 Série max: ${gameState.maxStreak}\n\nJouez aussi : ${window.location.origin}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Mon score Quiz Master',
            text: text
        }).catch(err => console.log('Erreur partage:', err));
    } else {
        // Copier dans le presse-papiers
        navigator.clipboard.writeText(text).then(() => {
            alert('Score copié dans le presse-papiers !');
        });
    }
}

// Confetti
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
            p.vy += 0.1; // Gravité
            
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

// Sons
function initSounds() {
    // Les sons sont déjà dans le HTML comme éléments audio
}

function playSound(type) {
    const sound = document.getElementById(type + 'Sound');
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(err => console.log('Erreur son:', err));
    }
}

// Utilitaires
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Thème sombre
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