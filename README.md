# Clipvault — Secure Clipboard Sharing

A professional dark-themed clipboard sharing app with 4-digit access codes.

## Features

- Save text/code/links with a generated **4-digit numeric code**
- Retrieve any clip instantly using its code
- Every clip expires automatically after 2 hours
- Tag types: General, Code, Link, Note
- View count tracking
- Shareable direct links (`?code=XXXX`)
- Auto-cleanup of expired clips
- Persistent storage via `data.json`

## Setup & Run

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
npm start
```

### 3. Open in browser
```
http://localhost:3000
```

## Development (auto-reload)
```bash
npm run dev
```
*(requires nodemon: `npm install -g nodemon`)*

## Project Structure

```
clipvault/
├── server.js          ← Express API server
├── package.json
├── data.json          ← Created automatically on first save
└── public/
    ├── index.html     ← App shell
    ├── style.css      ← All styles
    └── app.js         ← Client-side logic
```

## API Endpoints

| Method | Endpoint          | Description                |
|--------|-------------------|----------------------------|
| POST   | /api/clips        | Save clip, returns code    |
| GET    | /api/clips/:code  | Retrieve clip by 4-digit code |
| DELETE | /api/clips/:code  | Delete a clip              |

### POST /api/clips — Request body
```json
{
  "title":   "Optional title",
  "content": "Your text here",
  "tag":     "general | code | link | note",
  "ttl":     "2h"
}
```
