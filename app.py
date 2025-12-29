from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
import json
import os
from datetime import datetime
import random
import string

app = Flask(__name__)
app.config['SECRET_KEY'] = 'votre_cle_secrete_ici'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Charger les questions
def load_questions():
    with open('data/questions.json', 'r', encoding='utf-8') as f:
        return json.load(f)

QUESTIONS = load_questions()

# Stockage des salles multijoueurs
game_rooms = {}

def generate_room_code():
    """Générer un code de salle unique"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@app.route('/')
def index():
    """Page d'accueil"""
    return render_template('index.html')

@app.route('/quiz')
def quiz():
    """Page de quiz solo"""
    return render_template('quiz.html')

@app.route('/multiplayer')
def multiplayer():
    """Page multijoueur"""
    return render_template('multiplayer.html')

@app.route('/scores')
def scores():
    """Page des scores"""
    return render_template('scores.html')

@app.route('/api/questions/<category>')
def get_questions(category):
    """API pour récupérer les questions d'une catégorie"""
    if category in QUESTIONS:
        return jsonify(QUESTIONS[category])
    return jsonify({'error': 'Catégorie non trouvée'}), 404

@app.route('/api/categories')
def get_categories():
    """API pour récupérer la liste des catégories"""
    categories = {
        'maths': {
            'name': 'Mathématiques',
            'icon': '🔢',
            'description': 'Calculs, géométrie et algèbre',
            'count': len(QUESTIONS.get('maths', []))
        },
        'geo_madagascar': {
            'name': 'Géo Madagascar',
            'icon': '🇲🇬',
            'description': 'Géographie de Madagascar',
            'count': len(QUESTIONS.get('geo_madagascar', []))
        },
        'geo_afrique': {
            'name': 'Géo Afrique',
            'icon': '🌍',
            'description': 'Géographie africaine',
            'count': len(QUESTIONS.get('geo_afrique', []))
        },
        'culture_generale': {
            'name': 'Culture Générale',
            'icon': '📚',
            'description': 'Histoire, arts et sciences',
            'count': len(QUESTIONS.get('culture_generale', []))
        },
        'python': {
            'name': 'Python',
            'icon': '🐍',
            'description': 'Programmation Python',
            'count': len(QUESTIONS.get('python', []))
        }
    }
    return jsonify(categories)

@app.route('/api/save-score', methods=['POST'])
def save_score():
    """API pour sauvegarder un score"""
    data = request.get_json()
    return jsonify({'success': True, 'message': 'Score enregistré'})

# ================ SOCKET.IO EVENTS - MULTIJOUEUR ================

@socketio.on('connect')
def handle_connect():
    """Connexion d'un joueur"""
    print(f'Client connecté: {request.sid}')
    emit('connected', {'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    """Déconnexion d'un joueur"""
    print(f'Client déconnecté: {request.sid}')
    
    # Retirer le joueur de toutes les salles
    for room_code, room in list(game_rooms.items()):
        if request.sid in [p['sid'] for p in room['players']]:
            # Retirer le joueur
            room['players'] = [p for p in room['players'] if p['sid'] != request.sid]
            
            # Notifier les autres joueurs
            emit('player_left', {
                'sid': request.sid,
                'players_count': len(room['players'])
            }, room=room_code)
            
            # Supprimer la salle si vide
            if len(room['players']) == 0:
                del game_rooms[room_code]
            elif room['host_sid'] == request.sid and len(room['players']) > 0:
                # Transférer l'hôte au premier joueur restant
                room['host_sid'] = room['players'][0]['sid']
                emit('new_host', {
                    'host_sid': room['host_sid']
                }, room=room_code)

@socketio.on('create_room')
def handle_create_room(data):
    """Créer une nouvelle salle"""
    room_code = generate_room_code()
    
    game_rooms[room_code] = {
        'code': room_code,
        'host_sid': request.sid,
        'category': data.get('category', 'maths'),
        'max_players': data.get('max_players', 4),
        'questions_count': data.get('questions_count', 20),
        'players': [{
            'sid': request.sid,
            'name': data.get('player_name', 'Joueur'),
            'score': 0,
            'ready': False,
            'avatar': data.get('avatar', '😀')
        }],
        'status': 'waiting',  # waiting, playing, finished
        'current_question': 0,
        'questions': [],
        'answers': {}
    }
    
    join_room(room_code)
    
    emit('room_created', {
        'room_code': room_code,
        'room': game_rooms[room_code]
    })
    
    print(f'Salle créée: {room_code}')

@socketio.on('join_room')
def handle_join_room(data):
    """Rejoindre une salle existante"""
    room_code = data.get('room_code', '').upper()
    
    if room_code not in game_rooms:
        emit('error', {'message': 'Salle introuvable'})
        return
    
    room = game_rooms[room_code]
    
    if room['status'] != 'waiting':
        emit('error', {'message': 'La partie a déjà commencé'})
        return
    
    if len(room['players']) >= room['max_players']:
        emit('error', {'message': 'Salle pleine'})
        return
    
    # Ajouter le joueur
    room['players'].append({
        'sid': request.sid,
        'name': data.get('player_name', 'Joueur'),
        'score': 0,
        'ready': False,
        'avatar': data.get('avatar', '😀')
    })
    
    join_room(room_code)
    
    # Notifier le joueur
    emit('room_joined', {
        'room_code': room_code,
        'room': room
    })
    
    # Notifier tous les joueurs de la salle
    emit('player_joined', {
        'players': room['players'],
        'players_count': len(room['players'])
    }, room=room_code)
    
    print(f'Joueur {data.get("player_name")} a rejoint {room_code}')

@socketio.on('leave_room')
def handle_leave_room(data):
    """Quitter une salle"""
    room_code = data.get('room_code')
    
    if room_code in game_rooms:
        room = game_rooms[room_code]
        room['players'] = [p for p in room['players'] if p['sid'] != request.sid]
        
        leave_room(room_code)
        
        emit('player_left', {
            'sid': request.sid,
            'players': room['players'],
            'players_count': len(room['players'])
        }, room=room_code)
        
        # Supprimer la salle si vide
        if len(room['players']) == 0:
            del game_rooms[room_code]

@socketio.on('player_ready')
def handle_player_ready(data):
    """Joueur prêt à commencer"""
    room_code = data.get('room_code')
    
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    
    # Marquer le joueur comme prêt
    for player in room['players']:
        if player['sid'] == request.sid:
            player['ready'] = True
            break
    
    # Notifier tous les joueurs
    emit('player_ready_update', {
        'players': room['players']
    }, room=room_code)
    
    # Vérifier si tous les joueurs sont prêts
    all_ready = all(p['ready'] for p in room['players'])
    if all_ready and len(room['players']) >= 2:
        emit('all_players_ready', {}, room=room_code)

@socketio.on('start_game')
def handle_start_game(data):
    """Démarrer la partie (uniquement l'hôte)"""
    room_code = data.get('room_code')
    
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    
    # Vérifier que c'est l'hôte
    if request.sid != room['host_sid']:
        emit('error', {'message': 'Seul l\'hôte peut démarrer'})
        return
    
    # Préparer les questions
    category = room['category']
    all_questions = QUESTIONS.get(category, [])
    selected_questions = random.sample(all_questions, min(room['questions_count'], len(all_questions)))
    
    room['questions'] = selected_questions
    room['status'] = 'playing'
    room['current_question'] = 0
    room['answers'] = {}
    
    # Réinitialiser les scores
    for player in room['players']:
        player['score'] = 0
    
    # Notifier tous les joueurs
    emit('game_started', {
        'total_questions': len(selected_questions)
    }, room=room_code)
    
    # Envoyer la première question
    send_question(room_code)

def send_question(room_code):
    """Envoyer la question actuelle à tous les joueurs"""
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    question_index = room['current_question']
    
    if question_index >= len(room['questions']):
        # Fin de la partie
        end_game(room_code)
        return
    
    question = room['questions'][question_index]
    room['answers'] = {}  # Réinitialiser les réponses
    
    # Envoyer la question (sans la réponse correcte)
    emit('new_question', {
        'question_number': question_index + 1,
        'total_questions': len(room['questions']),
        'question': {
            'id': question['id'],
            'question': question['question'],
            'choices': question['choices'],
            'difficulty': question['difficulty']
        }
    }, room=room_code)

@socketio.on('submit_answer')
def handle_submit_answer(data):
    """Soumettre une réponse"""
    room_code = data.get('room_code')
    answer = data.get('answer')
    time_taken = data.get('time_taken', 30)
    
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    question = room['questions'][room['current_question']]
    
    # Enregistrer la réponse
    is_correct = answer == question['correct']
    room['answers'][request.sid] = {
        'answer': answer,
        'is_correct': is_correct,
        'time_taken': time_taken
    }
    
    # Calculer le score
    if is_correct:
        points = 100 + (question['difficulty'] - 1) * 50
        speed_bonus = max(0, int((30 - time_taken) * 2))
        points += speed_bonus
        
        # Mettre à jour le score du joueur
        for player in room['players']:
            if player['sid'] == request.sid:
                player['score'] += points
                break
    
    # Notifier que le joueur a répondu
    emit('player_answered', {
        'sid': request.sid,
        'answered_count': len(room['answers']),
        'total_players': len(room['players'])
    }, room=room_code)
    
    # Si tous les joueurs ont répondu, passer à la question suivante
    if len(room['answers']) >= len(room['players']):
        # Envoyer les résultats
        emit('question_results', {
            'correct_answer': question['correct'],
            'explanation': question['explanation'],
            'players': room['players'],
            'answers': {
                sid: {
                    'is_correct': ans['is_correct'],
                    'time_taken': ans['time_taken']
                } for sid, ans in room['answers'].items()
            }
        }, room=room_code)
        
        # Passer à la question suivante après 5 secondes
        room['current_question'] += 1
        
        # Utiliser un délai pour envoyer la prochaine question
        socketio.start_background_task(delayed_next_question, room_code)

def delayed_next_question(room_code):
    """Envoyer la prochaine question après un délai"""
    socketio.sleep(5)
    if room_code in game_rooms:
        send_question(room_code)

def end_game(room_code):
    """Terminer la partie"""
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    room['status'] = 'finished'
    
    # Trier les joueurs par score
    sorted_players = sorted(room['players'], key=lambda x: x['score'], reverse=True)
    
    # Envoyer les résultats finaux
    emit('game_ended', {
        'players': sorted_players
    }, room=room_code)
    
    print(f'Partie terminée dans {room_code}')

@socketio.on('chat_message')
def handle_chat_message(data):
    """Gérer les messages du chat"""
    room_code = data.get('room_code')
    message = data.get('message')
    
    if room_code not in game_rooms:
        return
    
    room = game_rooms[room_code]
    
    # Trouver le nom du joueur
    player_name = 'Anonyme'
    for player in room['players']:
        if player['sid'] == request.sid:
            player_name = player['name']
            break
    
    # Envoyer le message à tous
    emit('chat_message', {
        'player_name': player_name,
        'message': message,
        'timestamp': datetime.now().isoformat()
    }, room=room_code)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)