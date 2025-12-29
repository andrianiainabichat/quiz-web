from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import os
from datetime import datetime
import random
import string

app = Flask(__name__)
# Correction : Clé secrète sécurisée pour le déploiement
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'votre_cle_secrete_ici')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# --- CHARGEMENT DES QUESTIONS ---
def load_questions():
    """Charger les questions avec sécurité si le dossier est absent"""
    file_path = 'data/questions.json'
    if not os.path.exists(file_path):
        # Création d'une structure vide si le fichier n'est pas trouvé pour éviter le crash
        print(f"ATTENTION : {file_path} introuvable.")
        return {}
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

QUESTIONS = load_questions()

# Stockage des salles multijoueurs
game_rooms = {}

def generate_room_code():
    """Générer un code de salle unique"""
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
    categories = {
        'maths': {'name': 'Mathématiques', 'icon': '🔢', 'description': 'Calculs...', 'count': len(QUESTIONS.get('maths', []))},
        'geo_madagascar': {'name': 'Géo Madagascar', 'icon': '🇲🇬', 'description': 'Géo...', 'count': len(QUESTIONS.get('geo_madagascar', []))},
        'geo_afrique': {'name': 'Géo Afrique', 'icon': '🌍', 'description': 'Géo...', 'count': len(QUESTIONS.get('geo_afrique', []))},
        'culture_generale': {'name': 'Culture Générale', 'icon': '📚', 'description': 'Culture...', 'count': len(QUESTIONS.get('culture_generale', []))},
        'python': {'name': 'Python', 'icon': '🐍', 'description': 'Programmation...', 'count': len(QUESTIONS.get('python', []))}
    }
    return jsonify(categories)

@app.route('/api/save-score', methods=['POST'])
def save_score():
    data = request.get_json()
    return jsonify({'success': True, 'message': 'Score enregistré'})

# ================ SOCKET.IO EVENTS - MULTIJOUEUR ================

@socketio.on('connect')
def handle_connect():
    emit('connected', {'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    for room_code, room in list(game_rooms.items()):
        if request.sid in [p['sid'] for p in room['players']]:
            room['players'] = [p for p in room['players'] if p['sid'] != request.sid]
            emit('player_left', {'sid': request.sid, 'players_count': len(room['players'])}, room=room_code)
            
            if len(room['players']) == 0:
                del game_rooms[room_code]
            elif room['host_sid'] == request.sid and len(room['players']) > 0:
                room['host_sid'] = room['players'][0]['sid']
                emit('new_host', {'host_sid': room['host_sid']}, room=room_code)

@socketio.on('create_room')
def handle_create_room(data):
    room_code = generate_room_code()
    game_rooms[room_code] = {
        'code': room_code,
        'host_sid': request.sid,
        'category': data.get('category', 'maths'),
        'max_players': data.get('max_players', 4),
        'questions_count': data.get('questions_count', 20),
        'players': [{'sid': request.sid, 'name': data.get('player_name', 'Joueur'), 'score': 0, 'ready': False, 'avatar': data.get('avatar', '😀')}],
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
        emit('error', {'message': 'Impossible de rejoindre'})
        return
    room['players'].append({'sid': request.sid, 'name': data.get('player_name', 'Joueur'), 'score': 0, 'ready': False, 'avatar': data.get('avatar', '😀')})
    join_room(room_code)
    emit('room_joined', {'room_code': room_code, 'room': room})
    emit('player_joined', {'players': room['players'], 'players_count': len(room['players'])}, room=room_code)

@socketio.on('player_ready')
def handle_player_ready(data):
    room_code = data.get('room_code')
    if room_code in game_rooms:
        room = game_rooms[room_code]
        for player in room['players']:
            if player['sid'] == request.sid:
                player['ready'] = True
        emit('player_ready_update', {'players': room['players']}, room=room_code)
        if all(p['ready'] for p in room['players']) and len(room['players']) >= 2:
            emit('all_players_ready', {}, room=room_code)

@socketio.on('start_game')
def handle_start_game(data):
    room_code = data.get('room_code')
    if room_code in game_rooms:
        room = game_rooms[room_code]
        if request.sid != room['host_sid']: return
        all_q = QUESTIONS.get(room['category'], [])
        room['questions'] = random.sample(all_q, min(room['questions_count'], len(all_q)))
        room['status'] = 'playing'
        room['current_question'] = 0
        for p in room['players']: p['score'] = 0
        emit('game_started', {'total_questions': len(room['questions'])}, room=room_code)
        send_question(room_code)

def send_question(room_code):
    if room_code in game_rooms:
        room = game_rooms[room_code]
        idx = room['current_question']
        if idx >= len(room['questions']):
            end_game(room_code)
            return
        q = room['questions'][idx]
        room['answers'] = {}
        emit('new_question', {
            'question_number': idx + 1,
            'total_questions': len(room['questions']),
            'question': {'id': q['id'], 'question': q['question'], 'choices': q['choices'], 'difficulty': q['difficulty']}
        }, room=room_code)

@socketio.on('submit_answer')
def handle_submit_answer(data):
    room_code = data.get('room_code')
    if room_code in game_rooms:
        room = game_rooms[room_code]
        q = room['questions'][room['current_question']]
        is_correct = data.get('answer') == q['correct']
        time_taken = data.get('time_taken', 30)
        room['answers'][request.sid] = {'is_correct': is_correct, 'time_taken': time_taken}
        if is_correct:
            points = 100 + (q['difficulty'] - 1) * 50 + max(0, int((30 - time_taken) * 2))
            for p in room['players']:
                if p['sid'] == request.sid: p['score'] += points
        emit('player_answered', {'sid': request.sid, 'answered_count': len(room['answers']), 'total_players': len(room['players'])}, room=room_code)
        if len(room['answers']) >= len(room['players']):
            emit('question_results', {
                'correct_answer': q['correct'], 'explanation': q['explanation'], 'players': room['players'],
                'answers': {sid: {'is_correct': a['is_correct'], 'time_taken': a['time_taken']} for sid, a in room['answers'].items()}
            }, room=room_code)
            room['current_question'] += 1
            socketio.start_background_task(delayed_next_question, room_code)

def delayed_next_question(room_code):
    socketio.sleep(5)
    send_question(room_code)

def end_game(room_code):
    if room_code in game_rooms:
        room = game_rooms[room_code]
        room['status'] = 'finished'
        sorted_p = sorted(room['players'], key=lambda x: x['score'], reverse=True)
        emit('game_ended', {'players': sorted_p}, room=room_code)

@socketio.on('chat_message')
def handle_chat_message(data):
    room_code = data.get('room_code')
    if room_code in game_rooms:
        name = next((p['name'] for p in game_rooms[room_code]['players'] if p['sid'] == request.sid), 'Anonyme')
        emit('chat_message', {'player_name': name, 'message': data.get('message'), 'timestamp': datetime.now().isoformat()}, room=room_code)

# --- LANCEMENT ---
if __name__ == '__main__':
    # Modification cruciale pour l'hébergement
    port = int(os.environ.get('PORT', 8000))
    socketio.run(app, host='0.0.0.0', port=port)
