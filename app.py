from flask import Flask, render_template, request, jsonify, session
import os
from google import genai

app = Flask(__name__)
app.secret_key = os.urandom(24)

# ───────────────── API KEY ─────────────────
api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    print("⚠️  GEMINI_API_KEY tidak ditemukan! Set environment variable terlebih dahulu.")
    print('   PowerShell: $env:GEMINI_API_KEY="YOUR_API_KEY"')

# ───────────────── GENAI CLIENT ─────────────────
client = None
chat_sessions = {}

def get_client():
    global client
    if client is None and api_key:
        client = genai.Client(api_key=api_key)
    return client

def get_chat_session(session_id):
    """Get or create a chat session for the given session ID."""
    if session_id not in chat_sessions:
        c = get_client()
        if c:
            chat_sessions[session_id] = c.chats.create(model="gemini-2.5-flash")
    return chat_sessions.get(session_id)

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

    if not user_message:
        return jsonify({'error': 'Pesan kosong'}), 400

    if not api_key:
        return jsonify({'error': 'API KEY belum di-set'}), 500

    session_id = session.get('session_id', 'default')
    chat_session = get_chat_session(session_id)

    if not chat_session:
        return jsonify({'error': 'Gagal membuat chat session'}), 500

    try:
        response = chat_session.send_message(user_message)
        return jsonify({'reply': response.text})
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
