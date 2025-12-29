// Variables globales
let allScores = [];
let currentFilter = 'all';
let charts = {};

// Catégories
const categoryNames = {
    'maths': 'Mathématiques',
    'geo_madagascar': 'Géo Madagascar',
    'geo_afrique': 'Géo Afrique',
    'culture_generale': 'Culture Générale',
    'python': 'Python'
};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    loadScores();
    initThemeToggle();
});

// Charger les scores
function loadScores() {
    allScores = JSON.parse(localStorage.getItem('quizScores') || '[]');
    displayScores();
    displayStats();
    createCharts();
}

// Afficher les scores
function displayScores() {
    const container = document.getElementById('topScoresList');
    
    // Filtrer les scores
    let scores = allScores;
    if (currentFilter !== 'all') {
        scores = allScores.filter(s => s.category === currentFilter);
    }
    
    // Trier par score
    scores.sort((a, b) => b.score - a.score);
    
    // Prendre le top 10
    const top10 = scores.slice(0, 10);
    
    if (top10.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Aucun score enregistré</p>';
        return;
    }
    
    container.innerHTML = top10.map((score, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        
        return `
            <div class="score-card mb-3 ${rankClass}">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center flex-grow-1">
                        <div class="score-rank-badge me-3">
                            ${medal || rank}
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>${score.playerName}</strong>
                                    <div class="small text-muted">
                                        ${categoryNames[score.category] || score.category}
                                        ${score.mode === 'hardcore' ? '<span class="badge bg-danger ms-1">Hardcore</span>' : ''}
                                    </div>
                                </div>
                                <div class="text-end">
                                    <div class="score-value">${score.score}</div>
                                    <div class="small text-muted">${score.correctAnswers}/${score.totalQuestions}</div>
                                </div>
                            </div>
                            <div class="score-details mt-2">
                                <span class="badge bg-primary">
                                    <i class="fas fa-fire"></i> ${score.maxStreak}
                                </span>
                                <span class="badge bg-info">
                                    <i class="fas fa-clock"></i> ${score.avgTime}s
                                </span>
                                <span class="small text-muted ms-2">
                                    ${new Date(score.date).toLocaleDateString('fr-FR')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Afficher les statistiques
function displayStats() {
    if (allScores.length === 0) {
        document.getElementById('totalGames').textContent = '0';
        document.getElementById('avgScore').textContent = '0';
        document.getElementById('bestStreak').textContent = '0';
        document.getElementById('avgAccuracy').textContent = '0%';
        return;
    }
    
    // Filtrer si nécessaire
    let scores = allScores;
    if (currentFilter !== 'all') {
        scores = allScores.filter(s => s.category === currentFilter);
    }
    
    if (scores.length === 0) {
        document.getElementById('totalGames').textContent = '0';
        document.getElementById('avgScore').textContent = '0';
        document.getElementById('bestStreak').textContent = '0';
        document.getElementById('avgAccuracy').textContent = '0%';
        return;
    }
    
    // Total de parties
    document.getElementById('totalGames').textContent = scores.length;
    
    // Score moyen
    const avgScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
    document.getElementById('avgScore').textContent = avgScore;
    
    // Meilleure série
    const bestStreak = Math.max(...scores.map(s => s.maxStreak));
    document.getElementById('bestStreak').textContent = bestStreak;
    
    // Précision moyenne
    const avgAccuracy = scores.reduce((sum, s) => {
        return sum + (s.correctAnswers / s.totalQuestions);
    }, 0) / scores.length;
    document.getElementById('avgAccuracy').textContent = Math.round(avgAccuracy * 100) + '%';
}

// Créer les graphiques
function createCharts() {
    createScoresChart();
    createCategoryChart();
}

// Graphique de progression des scores
function createScoresChart() {
    const ctx = document.getElementById('scoresChart');
    
    if (charts.scoresChart) {
        charts.scoresChart.destroy();
    }
    
    // Filtrer et limiter aux 20 derniers scores
    let scores = allScores;
    if (currentFilter !== 'all') {
        scores = allScores.filter(s => s.category === currentFilter);
    }
    
    const last20 = scores.slice(-20);
    
    if (last20.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }
    
    charts.scoresChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last20.map((s, i) => `#${i + 1}`),
            datasets: [{
                label: 'Score',
                data: last20.map(s => s.score),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const score = last20[context[0].dataIndex];
                            return score.playerName;
                        },
                        label: function(context) {
                            return `Score: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Graphique par catégorie
function createCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    
    if (charts.categoryChart) {
        charts.categoryChart.destroy();
    }
    
    if (allScores.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }
    
    // Calculer les moyennes par catégorie
    const categoryScores = {};
    const categoryCounts = {};
    
    allScores.forEach(score => {
        if (!categoryScores[score.category]) {
            categoryScores[score.category] = 0;
            categoryCounts[score.category] = 0;
        }
        categoryScores[score.category] += score.score;
        categoryCounts[score.category]++;
    });
    
    const categories = Object.keys(categoryScores);
    const avgScores = categories.map(cat => 
        Math.round(categoryScores[cat] / categoryCounts[cat])
    );
    
    const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'
    ];
    
    charts.categoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories.map(cat => categoryNames[cat] || cat),
            datasets: [{
                label: 'Score moyen',
                data: avgScores,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Filtrer par catégorie
function filterByCategory(category) {
    currentFilter = category;
    
    // Mettre à jour les boutons actifs
    document.querySelectorAll('.btn-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Recharger l'affichage
    displayScores();
    displayStats();
    createScoresChart();
}

// Réinitialiser les scores
function clearScores() {
    if (confirm('Êtes-vous sûr de vouloir supprimer tous les scores ?')) {
        localStorage.removeItem('quizScores');
        allScores = [];
        displayScores();
        displayStats();
        
        // Détruire les graphiques
        if (charts.scoresChart) charts.scoresChart.destroy();
        if (charts.categoryChart) charts.categoryChart.destroy();
        
        alert('Tous les scores ont été supprimés');
    }
}

// Exporter en CSV
function exportScores() {
    if (allScores.length === 0) {
        alert('Aucun score à exporter');
        return;
    }
    
    // Créer le contenu CSV
    let csv = 'Joueur,Catégorie,Mode,Score,Bonnes réponses,Total questions,Série max,Temps moyen,Date\n';
    
    allScores.forEach(score => {
        csv += `${score.playerName},`;
        csv += `${categoryNames[score.category] || score.category},`;
        csv += `${score.mode},`;
        csv += `${score.score},`;
        csv += `${score.correctAnswers},`;
        csv += `${score.totalQuestions},`;
        csv += `${score.maxStreak},`;
        csv += `${score.avgTime},`;
        csv += `${new Date(score.date).toLocaleString('fr-FR')}\n`;
    });
    
    // Créer un blob et télécharger
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `quiz-scores-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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