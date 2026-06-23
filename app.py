from flask import Flask, render_template, request, jsonify, session
import os
from groq import Groq

# Load variables from .env file automatically
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        for line in f:
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k.strip()] = v.strip().strip("'").strip('"')

app = Flask(__name__)
app.secret_key = os.urandom(24)

# ───────────────── API KEY ─────────────────
api_key = os.environ.get('GROQ_API_KEY')

# ───────────────── GROQ CLIENT ─────────────────
client = None
chat_sessions = {}

def get_client():
    global client
    if client is None and api_key:
        client = Groq(api_key=api_key)
    return client

# ───────────────── ROUTES ─────────────────
@app.route('/')
def index():
    if 'session_id' not in session:
        session['session_id'] = os.urandom(16).hex()
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '').strip()
    history_data = data.get('history', [])  # Menerima history obrolan dari user (frontend)

    if not user_message:
        return jsonify({'error': 'Pesan kosong'}), 400

    current_api_key = os.environ.get('GROQ_API_KEY')

    try:
        # Hubungkan ke Groq API
        local_client = Groq(api_key=current_api_key)
        
        # Format history agar sesuai dengan kebutuhan SDK Groq
        formatted_history = []
        
        # System prompt
        formatted_history.append({
            "role": "system",
            "content": "Kamu adalah ViraAkbar Engine v2. Asisten AI Premium yang sangat cerdas, responsif, dan dibuat oleh Akbar. Jawab dengan gaya keren, solutif, dan gunakan bahasa Indonesia yang santun namun santai."
        })
        
        for msg in history_data:
            role = msg.get('role', 'user')
            if role == 'model' or role == 'v2':
                role = 'assistant'
            text = msg.get('text', '')
            if text:
                formatted_history.append({
                    "role": role,
                    "content": text
                })
                
        # Pesan user saat ini
        formatted_history.append({
            "role": "user",
            "content": user_message
        })

        chat_completion = local_client.chat.completions.create(
            messages=formatted_history,
            model="llama-3.3-70b-versatile",
            temperature=0.7
        )

        return jsonify({'reply': chat_completion.choices[0].message.content})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/new-chat', methods=['POST'])
def new_chat():
    session_id = session.get('session_id', 'default')
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    session['session_id'] = os.urandom(16).hex()
    return jsonify({'status': 'ok'})

# ───────────────── RUN ─────────────────
if __name__ == '__main__':
    app.run(debug=True, port=5000)