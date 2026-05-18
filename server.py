"""
ColdCraft — Flask Backend
Handles Gmail OAuth2 and email sending with resume attachment.
"""

import os, base64, mimetypes, hashlib, string, json
from random import SystemRandom
from flask import Flask, request, jsonify, redirect, session, url_for, send_from_directory
from flask_cors import CORS
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__, static_folder='.')
app.secret_key = 'coldcraft-secret-2024-xk92'
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = 600
CORS(app, supports_credentials=True)

# In-memory store: state → code_verifier (reliable across redirects)
_oauth_store = {}

SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
]
CLIENT_SECRETS_FILE = 'client_secret.json'
CREDS_FILE          = 'gmail_creds.json'



def _make_code_verifier():
    chars = string.ascii_letters + string.digits + '-._~'
    return ''.join(SystemRandom().choice(chars) for _ in range(128))

def _make_code_challenge(verifier):
    digest = hashlib.sha256(verifier.encode('ascii')).digest()
    return base64.urlsafe_b64encode(digest).decode('ascii').rstrip('=')

def _save_creds(creds_dict):
    with open(CREDS_FILE, 'w') as f:
        json.dump(creds_dict, f)

def _load_creds():
    if os.path.exists(CREDS_FILE):
        with open(CREDS_FILE) as f:
            return json.load(f)
    return None


# ── Static files ─────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.route('/auth/login')
def login():
    if not os.path.exists(CLIENT_SECRETS_FILE):
        return jsonify({'error': 'client_secret.json not found'}), 500

    verifier  = _make_code_verifier()
    challenge = _make_code_challenge(verifier)

    flow = Flow.from_client_secrets_file(CLIENT_SECRETS_FILE, scopes=SCOPES)
    flow.redirect_uri = url_for('oauth2callback', _external=True)

    auth_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent',
        code_challenge=challenge,
        code_challenge_method='S256'
    )

    # Store verifier server-side keyed by state — no session cookie needed
    _oauth_store[state] = verifier
    return jsonify({'auth_url': auth_url})


@app.route('/oauth2callback')
def oauth2callback():
    state    = request.args.get('state', '')
    verifier = _oauth_store.pop(state, '')  # retrieve & remove

    flow = Flow.from_client_secrets_file(CLIENT_SECRETS_FILE, scopes=SCOPES, state=state)
    flow.redirect_uri = url_for('oauth2callback', _external=True)

    flow.fetch_token(
        authorization_response=request.url,
        code_verifier=verifier
    )

    creds = flow.credentials
    creds_dict = {
        'token':         creds.token,
        'refresh_token': creds.refresh_token,
        'token_uri':     creds.token_uri,
        'client_id':     creds.client_id,
        'client_secret': creds.client_secret,
        'scopes':        list(creds.scopes or []),
    }
    session['credentials'] = creds_dict
    _save_creds(creds_dict)   # persist to disk

    try:
        svc  = build('oauth2', 'v2', credentials=Credentials(**creds_dict))
        info = svc.userinfo().get().execute()
        session['user_email'] = info.get('email', '')
        _save_creds({**creds_dict, '_email': session['user_email']})
    except Exception:
        session['user_email'] = ''

    return redirect(f'http://localhost:5001/?auth=success&email={session["user_email"]}')


@app.route('/auth/status')
def auth_status():
    # Check session first, then fall back to saved file
    if 'credentials' not in session:
        saved = _load_creds()
        if saved:
            session['credentials'] = {k: v for k, v in saved.items() if not k.startswith('_')}
            session['user_email']  = saved.get('_email', '')
    if 'credentials' in session:
        return jsonify({'authenticated': True, 'email': session.get('user_email', '')})
    return jsonify({'authenticated': False, 'email': ''})


@app.route('/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


# ── Send Email ────────────────────────────────────────────────────────────────

@app.route('/send_email', methods=['POST'])
def send_email():
    if 'credentials' not in session:
        saved = _load_creds()
        if saved:
            session['credentials'] = {k: v for k, v in saved.items() if not k.startswith('_')}
            session['user_email']  = saved.get('_email', '')
            
    if 'credentials' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    data        = request.get_json()
    to          = data.get('to', '')
    subject     = data.get('subject', '')
    body        = data.get('body', '')
    resume_b64  = data.get('resume_b64')
    resume_name = data.get('resume_name', 'resume.pdf')

    try:
        creds   = Credentials(**session['credentials'])
        service = build('gmail', 'v1', credentials=creds)

        if resume_b64:
            msg = MIMEMultipart()
            msg['to']      = to
            msg['subject'] = subject
            msg.attach(MIMEText(body, 'plain'))
            file_data      = base64.b64decode(resume_b64)
            mime_type, _   = mimetypes.guess_type(resume_name)
            main_t, sub_t  = (mime_type.split('/', 1) if mime_type else ('application', 'octet-stream'))
            part = MIMEBase(main_t, sub_t)
            part.set_payload(file_data)
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', 'attachment', filename=resume_name)
            msg.attach(part)
        else:
            msg            = MIMEText(body, 'plain')
            msg['to']      = to
            msg['subject'] = subject

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId='me', body={'raw': raw}).execute()
        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print('\n✦ ColdCraft server running at http://localhost:5001\n')
    app.run(port=5001, debug=True, use_reloader=False)
