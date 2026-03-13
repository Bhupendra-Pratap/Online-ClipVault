# Clipvault — Secure Clipboard Sharing

A professional dark-themed clipboard sharing app with 4-digit access codes.

## Features

- Save text/code/links with a generated **4-digit numeric code**
- Retrieve any clip instantly using its code
- Every clip expires automatically after 2 hours
- Tag types: General, Code, Link, Note
- View count tracking
- Shareable direct links (`?code=XXXX`)
- Automatic expiry via MongoDB TTL index
- Persistent storage via MongoDB Atlas

## Setup & Run

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_DB=clipvault
MONGODB_COLLECTION=clips
```

For local development, put those values in a `.env` file in the project root. `example.env` is only a template and is not loaded automatically.

### 3. Start the server
```bash
npm start
```

### 4. Open in browser
```
http://localhost:3000
```

## Development (auto-reload)
```bash
npm run dev
```
*(requires nodemon: `npm install -g nodemon`)*

## Vercel Deployment

Add the same `MONGODB_URI`, `MONGODB_DB`, and `MONGODB_COLLECTION` variables in your Vercel project settings before deploying.

## Project Structure

```
clipvault/
├── server.js          ← Express API server
├── lib/
│   └── mongodb.js     ← MongoDB Atlas connection helper
├── package.json
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
