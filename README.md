# 🎯 Quiz Master - Application Web de Quiz Interactive

Application web complète de quiz développée en Python Flask avec une interface moderne et responsive.

## 📋 Caractéristiques

### 🎮 Modes de Jeu
- **Solo** : Mode classique avec 3 vies
- **Hardcore** : 1 seule vie, points doublés
- **Multi** : Mode multijoueur (à venir)

### 📚 Catégories de Quiz
- **Mathématiques** : 40 questions (calculs, géométrie, algèbre)
- **Géographie Madagascar** : 40 questions sur Madagascar
- **Géographie Afrique** : 40 questions sur le continent africain
- **Culture Générale** : 40 questions variées
- **Python** : 40 questions de programmation

### 🎨 Interface
- Design moderne avec Bootstrap 5
- Animations CSS fluides
- Mode sombre/clair
- Responsive (mobile-first)
- Icônes Font Awesome
- Confetti pour les victoires

### ⚡ Fonctionnalités
- Timer de 30 secondes par question
- Système de score avancé :
  - 100 points de base
  - Bonus de rapidité
  - Bonus de difficulté
  - Bonus de série (3+ bonnes réponses consécutives)
  - Mode hardcore × 2
- 3 vies (1 en hardcore)
- Explications détaillées après chaque réponse
- Barre de progression
- Sons HTML5 (bonne/mauvaise réponse)

### 📊 Tableau de Bord
- Top 10 des meilleurs scores
- Statistiques globales
- Graphiques Chart.js
- Filtrage par catégorie
- Export CSV des scores
- Partage des résultats

### 💾 Persistance des Données
- localStorage pour les scores
- Sauvegarde JSON côté serveur (optionnel)
- PWA ready avec manifest.json

## 🚀 Installation

### Prérequis
- Python 3.8+
- pip

### Installation des dépendances

```bash
cd quiz_web
pip install -r requirements.txt
```

### Lancement de l'application

```bash
python app.py
```

L'application sera accessible sur `http://localhost:5000`

## 📁 Structure du Projet

```
quiz_web/
├── app.py                      # Serveur Flask
├── requirements.txt            # Dépendances Python
├── data/
│   └── questions.json          # 200 questions en français
├── templates/
│   ├── index.html             # Page d'accueil
│   ├── quiz.html              # Page de quiz
│   └── scores.html            # Page des scores
├── static/
│   ├── css/
│   │   └── style.css          # Styles CSS complets
│   ├── js/
│   │   ├── quiz.js            # Logique du quiz
│   │   └── scores.js          # Gestion des scores
│   └── manifest.json          # Configuration PWA
└── README.md
```

## 🎯 Comment Jouer

1. **Accueil** : Sélectionnez un mode de jeu et une catégorie
2. **Quiz** : Répondez aux questions dans le temps imparti (30s)
3. **Score** : Accumulez des points avec les bonus
4. **Résultats** : Consultez vos statistiques et le classement

## 🏆 Système de Score

### Points de Base
- Question facile : 100 points
- Question moyenne : 150 points
- Question difficile : 200 points

### Bonus
- **Rapidité** : Jusqu'à +60 points (réponse rapide)
- **Série** : +10 points par question dans la série (min. 3)
- **Mode Hardcore** : Tous les points × 2

### Pénalités
- Mauvaise réponse : -1 vie
- Timeout : -1 vie, 0 point
- Série cassée : Retour à 0

## 🛠️ Technologies Utilisées

### Backend
- Python 3.8+
- Flask 3.0.0
- Flask-CORS 4.0.0

### Frontend
- HTML5
- CSS3 (animations, flexbox, grid)
- JavaScript ES6+
- Bootstrap 5.3.0
- Font Awesome 6.4.0
- Chart.js (graphiques)

### Stockage
- localStorage (client)
- JSON (serveur optionnel)

## 📱 Progressive Web App (PWA)

L'application est compatible PWA :
- Manifest.json configuré
- Peut être installée sur mobile
- Fonctionne hors ligne (avec service worker à ajouter)

## 🎨 Personnalisation

### Ajouter des Questions

Éditez `data/questions.json` :

```json
{
  "id": 201,
  "question": "Votre question ?",
  "choices": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0,
  "difficulty": 1,
  "explanation": "Explication de la réponse"
}
```

### Modifier les Couleurs

Dans `static/css/style.css`, modifiez les variables CSS :

```css
:root {
    --primary-color: #3b82f6;
    --success-color: #10b981;
    --danger-color: #ef4444;
}
```

## 🔧 Développement

### Mode Debug

Le serveur Flask est configuré en mode debug par défaut :

```python
app.run(debug=True, host='0.0.0.0', port=5000)
```

### API Endpoints

- `GET /` - Page d'accueil
- `GET /quiz` - Page de quiz
- `GET /scores` - Page des scores
- `GET /api/categories` - Liste des catégories
- `GET /api/questions/<category>` - Questions d'une catégorie
- `POST /api/save-score` - Sauvegarder un score

## 📈 Fonctionnalités Avancées

### Export CSV
Les scores peuvent être exportés en CSV pour analyse externe.

### Partage de Résultats
Les joueurs peuvent partager leurs scores via :
- API Web Share (mobile)
- Copie dans le presse-papiers
- URL avec paramètres

### Mode Hardcore
- 1 seule vie
- Points × 2
- Badge spécial dans le classement

## 🔐 Sécurité

- CORS configuré pour les requêtes API
- Validation côté serveur recommandée
- Échappement des données utilisateur

## 🐛 Dépannage

### Les questions ne se chargent pas
- Vérifiez que `data/questions.json` existe
- Vérifiez la console pour les erreurs

### Les scores ne sont pas sauvegardés
- Vérifiez que localStorage est activé
- Vérifiez les permissions du navigateur

### Les sons ne fonctionnent pas
- Nécessite une interaction utilisateur
- Vérifiez que les navigateurs autorisent l'audio

## 📄 Licence

Ce projet est libre d'utilisation pour des fins éducatives.

## 👤 Auteur

Développé avec ❤️ en Python Flask

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer de nouvelles fonctionnalités
- Ajouter des questions
- Améliorer le design

## 📞 Support

Pour toute question ou problème, ouvrez une issue sur le dépôt.

---

**Amusez-vous bien avec Quiz Master ! 🎉**