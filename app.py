from flask import Flask, render_template, request, jsonify, session, send_from_directory
import os
import json
from groq import Groq
from duckduckgo_search import DDGS

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
            "content": "Kamu adalah ViraAkbar Engine v2. Asisten AI Premium yang sangat cerdas, responsif, dan dibuat oleh Akbar. Jawab dengan gaya keren, solutif, dan gunakan bahasa Indonesia yang santun namun santai. Kamu memiliki kemampuan untuk mencari informasi di internet menggunakan alat pencarian jika ditanya tentang berita terbaru, cuaca, tokoh, atau informasi aktual yang mungkin tidak ada di data awalmu."
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

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "search_web",
                    "description": "Cari informasi di internet (web search) untuk menjawab pertanyaan terkini atau mencari berita terbaru.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Kata kunci pencarian, misalnya 'berita hari ini', 'harga bitcoin terbaru', dll.",
                            }
                        },
                        "required": ["query"],
                    },
                },
            }
        ]

        chat_completion = local_client.chat.completions.create(
            messages=formatted_history,
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            tools=tools,
            tool_choice="auto"
        )

        response_message = chat_completion.choices[0].message
        
        # Cek apakah model memanggil tool (fungsi)
        if response_message.tool_calls:
            # Model ingin menggunakan alat
            formatted_history.append(response_message)
            for tool_call in response_message.tool_calls:
                if tool_call.function.name == "search_web":
                    function_args = json.loads(tool_call.function.arguments)
                    query = function_args.get("query")
                    
                    # Lakukan pencarian web
                    search_results = "Tidak ada hasil."
                    try:
                        results = DDGS().text(query, max_results=3)
                        if results:
                            search_results = json.dumps(results, ensure_ascii=False)
                    except Exception as e:
                        search_results = f"Error saat mencari: {str(e)}"
                    
                    # Tambahkan hasil pencarian ke history
                    formatted_history.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": "search_web",
                        "content": search_results,
                    })
            
            # Panggil model lagi dengan hasil pencarian
            second_response = local_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=formatted_history,
                temperature=0.7
            )
            return jsonify({'reply': second_response.choices[0].message.content})

        # Jika tidak ada tool call, langsung return
        return jsonify({'reply': response_message.content})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/new-chat', methods=['POST'])
def new_chat():
    session_id = session.get('session_id', 'default')
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    session['session_id'] = os.urandom(16).hex()
    return jsonify({'status': 'ok'})
@app.route('/google024f7ba3a16b7ac7.html')
def google_verification():
    return send_from_directory('static', 'google024f7ba3a16b7ac7.html')


if __name__ == "__main__":
    app.run()
