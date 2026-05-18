# ✦ ColdCraft — AI Cold Email Automation

> Turn your resume into 100 personalized cold emails in seconds, powered by Gemini AI.

![ColdCraft Banner](https://img.shields.io/badge/Powered%20by-Gemini%20AI-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-2.x-000000?style=for-the-badge&logo=flask&logoColor=white)
![Gmail API](https://img.shields.io/badge/Gmail-API-EA4335?style=for-the-badge&logo=gmail&logoColor=white)

---

## 🚀 What is ColdCraft?

ColdCraft is a full-stack web application that automates personalized cold email outreach. Paste your HR contact list, write your email template with `[Name]` and `[Company]` placeholders, upload your resume PDF — and ColdCraft generates and sends tailored emails to every recruiter via your own Gmail account.

---

## ✨ Features

- 📋 **Bulk HR Contact Import** — Paste CSV/TSV data or manually enter contacts
- ✉️ **Template-Based Personalization** — Use `[Name]`, `[Company]`, `[Role]` placeholders for instant personalization
- 📄 **Resume Attachment** — Upload your PDF resume once; it's automatically attached to every email
- 🔐 **Gmail OAuth2** — Sends emails directly from your Gmail account (no SMTP password needed)
- ✏️ **Inline Email Editor** — Review and edit each generated email before sending
- 📤 **Send All or One-by-One** — Full control over which emails get sent
- 💾 **Download / Copy** — Export all emails as a `.txt` file or copy to clipboard
- 🌙 **Dark Mode UI** — Premium glassmorphism design with smooth animations

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3 (Vanilla), JavaScript (ES6+) |
| Backend | Python 3, Flask |
| Auth | Google OAuth2 (via `google-auth-oauthlib`) |
| Email API | Gmail API (`googleapiclient`) |
| Fonts | Inter, JetBrains Mono (Google Fonts) |

---

## 📦 Project Structure

```
cold_email/
├── index.html          # Main frontend UI
├── app.js              # Frontend logic (CSV parsing, email generation, Gmail send)
├── styles.css          # Premium dark UI styles
├── server.py           # Flask backend (Gmail OAuth2 + send endpoint)
├── requirements.txt    # Python dependencies
├── client_secret.json  # Google OAuth credentials (not committed)
└── gmail_creds.json    # Saved Gmail tokens (not committed)
```

---

## ⚙️ Setup & Installation

### Prerequisites

- Python 3.9+
- A Google Cloud project with **Gmail API** enabled
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 1. Clone the repository

```bash
git clone https://github.com/Vansh-Munjal/cold-emailing.git
cd cold-emailing
```

### 2. Create a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project → Enable **Gmail API**
3. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
4. Choose **Web Application**
5. Add `http://localhost:5001` to **Authorized redirect URIs**
6. Download the credentials JSON and save it as `client_secret.json` in the project root

### 5. Run the server

```bash
./venv/bin/python3 server.py
```

Open your browser at **http://localhost:5001**

---

## 🎯 How to Use

1. **Step 01 — API & Gmail** — Enter your Gemini API key and connect your Gmail account via OAuth
2. **Step 02 — Target Role** — Specify the position you're applying for
3. **Step 03 — Resume PDF** — Upload your resume (it'll be attached to every email)
4. **Step 04 — Email Template** — Write your email body using `[Name]` and `[Company]` placeholders
5. **Step 05 — HR Contacts** — Paste your CSV list or manually enter contacts
6. **Generate** — Click "Generate Personalized Emails" to preview all emails
7. **Send** — Send all at once or individually via Gmail

### CSV Format

```csv
Name,Email,Title,Company
Priya Sharma,priya@techcorp.com,HR Manager,TechCorp India
Rahul Verma,rahul@startup.io,Talent Acquisition,Startup.io
```

---

## 🔒 Security & Privacy

- Your Gemini API key is **never sent to any server** — all email generation happens client-side
- Gmail OAuth tokens are stored locally in `gmail_creds.json` (gitignored)
- No email data is stored or logged anywhere
- Uses PKCE (Proof Key for Code Exchange) for secure OAuth flow

---

## 📋 Requirements

```
flask
flask-cors
google-auth-oauthlib
google-api-python-client
google-auth
```

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

---



<p align="center">Built with ❤️ by <a href="https://github.com/Vansh-Munjal">Vansh Munjal</a></p>
