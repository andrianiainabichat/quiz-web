from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import os
from datetime import datetime
import random
import string

app = Flask(__name__)
# Récupération sécurisée de la clé secrète
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'votre_cle_secrete_ici')
CORS(app)
# Configuration Socket.IO pour la production
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# --- CHARGEMENT SÉCURISÉ DES QUESTIONS ---
def load_questions():
    """Charge les questions sans faire planter le serveur en cas d'erreur"""
    # Construction du chemin absolu
    base_dir = os.path.abspath(os.path.dirname(__file__))
    file_path = os.path.join(base_dir, 'data', 'questions.json')
    
    print(f"--- Tentative de chargement : {file_path} ---")
    
    if not os.path.exists(file_path):
        print(f"ALERTE : Fichier {file_path} introuvable sur le serveur.")
        return {}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            print("Succès : Questions chargées correctement.")
            return data
    except Exception as e:
        print(f"ERREUR lors de la lecture du JSON : {e}")
        return {}

# Initialisation globale
QUESTIONS = load_questions()
game_rooms = {}

def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# --- ROUTES FLASK ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/quiz')
def quiz():
    return render_template('quiz.html')

@app.route('/multiplayer')
def multiplayer():
    return render_template('multiplayer.html')

@app.route('/scores')
def scores():
    return render_template('scores.html')

@app.route('/api/questions/<category>')
def get_questions(category):
    if category in QUESTIONS:
        return jsonify(QUESTIONS[category])
    return jsonify({'error': 'Catégorie non trouvée'}), 404

@app.route('/api/categories')
def get_categories():
    # On calcule le nombre de questions dynamiquement
    categories = {
        'maths': {'name': 'Mathématiques', 'icon': '🔢', 'count': len(QUESTIONS.get('maths', []))},
        'geo_madagascar': {'name': 'Géo Madagascar', 'icon': '🇲🇬', 'count': len(QUESTIONS.get('geo_madagascar', []))},
        'geo_afrique': {'name': 'Géo Afrique', 'icon': '🌍', 'count': len(QUESTIONS.get('geo_afrique', []))},
        'culture_generale': {'name': 'Culture Générale', 'icon': '📚', 'count': len(QUESTIONS.get('culture_generale', []))},
        'python': {'name': 'Python', 'icon': '🐍', 'count': len(QUESTIONS.get('python', []))}
    }
    return jsonify(categories)

# ================ SOCKET.IO EVENTS ================

@socketio.on('connect')
def handle_connect():
    emit('connected', {'sid': request.sid})

@socketio.on('create_room')
def handle_create_room(data):
    room_code = generate_room_code()
    game_rooms[room_code] = {
        'code': room_code,
        'host_sid': request.sid,
        'category': data.get('category', 'maths'),
        'max_players': data.get('max_players', 4),
        'questions_count': data.get('questions_count', 20),
        'players': [{'sid': request.sid, 'name': data.get('player_name', 'Hôte'), 'score': 0, 'ready': False, 'avatar': data.get('avatar', '😀')}],
        'status': 'waiting',
        'current_question': 0,
        'questions': [],
        'answers': {}
    }
    join_room(room_code)
    emit('room_created', {'room_code': room_code, 'room': game_rooms[room_code]})

@socketio.on('join_room')
def handle_join_room(data):
    room_code = data.get('room_code', '').upper()
    if room_code not in game_rooms:
        emit('error', {'message': 'Salle introuvable'})
        return
    room = game_rooms[room_code]
    if room['status'] != 'waiting' or len(room['players']) >= room['max_players']:
        emit('error', {'message': 'Salle pleine ou déjà en cours'})
        return
    
    new_player = {'sid': request.sid, 'name': data.get('player_name', 'Joueur'), 'score': 0, 'ready': False, 'avatar': data.get('avatar', '😀')}
    room['players'].append(new_player)
    join_room(room_code)
    emit('room_joined', {'room_code': room_code, 'room': room})
    emit('player_joined', {'players': room['players'], 'players_count': len(room['players'])}, room=room_code)

@socketio.on('submit_answer')
def handle_submit_answer(data):
    room_code = data.get('room_code')
    if room_code in game_rooms:
        room = game_rooms[room_code]
        # Logique de calcul simplifiée pour l'exemple
        emit('player_answered', {'sid': request.sid}, room=room_code)
        # ... Reste de votre logique de score ...

# --- LANCEMENT ---
if __name__ == '__main__':
    # Récupération dynamique du port pour Koyeb
    port = int(os.environ.get('PORT', 8000))
    print(f"Démarrage du serveur sur le port {port}...")
    socketio.run(app, host='0.0.0.0', port=port)
