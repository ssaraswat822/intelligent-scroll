# Intelligent Scroll 🧠

An AI-powered social media feed generator. Enter any topic and watch as AI creates realistic posts and discussions - or write your own post and get instant AI-generated comments!

## Features

- **🔍 Topic Explorer** - Generate feeds on any topic
- **✍️ New Post** - Write posts and get AI-generated comments
- **💬 Threaded Comments** - Realistic discussions with multiple perspectives
- **⚡ Ultra-Fast** - Powered by Groq's Llama models
- **♾️ Infinite Scroll** - Pre-loaded content for instant "Load More"

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Netlify Functions (serverless)
- **AI**: Groq API (Llama 3.3 70B)
- **Hosting**: Netlify

## Deploy to Netlify

### 1. Get a Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up / Log in
3. Create an API key

### 2. Deploy

#### Option A: One-Click Deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

#### Option B: Manual Deploy

1. Push this code to a GitHub repository

2. Go to [app.netlify.com](https://app.netlify.com)

3. Click "Add new site" → "Import an existing project"

4. Connect your GitHub repo

5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

6. Add environment variable:
   - Go to Site settings → Environment variables
   - Add: `GROQ_API_KEY` = your Groq API key

7. Deploy!

### 3. Local Development

```bash
# Install dependencies
npm install

# Create .env file
echo "GROQ_API_KEY=your_key_here" > .env

# Install Netlify CLI
npm install -g netlify-cli

# Run locally with functions
netlify dev
```

## Project Structure

```
intelligent-scroll/
├── index.html              # Entry HTML
├── src/
│   ├── main.jsx           # React entry
│   └── App.jsx            # Main app component
├── netlify/
│   └── functions/
│       └── generate.js    # Serverless API function
├── netlify.toml           # Netlify config
├── package.json
└── vite.config.js
```

## API Configuration

The serverless function (`netlify/functions/generate.js`) handles:
- Secure API key storage (server-side only)
- Groq API calls
- JSON parsing and cleaning

### Groq Models (in order of speed)

| Model | Speed | Quality |
|-------|-------|---------|
| `llama-3.1-8b-instant` | Fastest | Good |
| `llama-3.3-70b-versatile` | Fast | Excellent (default) |
| `mixtral-8x7b-32768` | Fast | Great |

To change models, edit `netlify/functions/generate.js`.

## Optional: Add Wikipedia Integration

To make posts more educational, you can enhance the serverless function to fetch Wikipedia content:

```javascript
// In generate.js, add before the Groq call:
const wikiResponse = await fetch(
  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`
);
const wikiData = await wikiResponse.json();
const context = wikiData.extract || '';

// Then include context in the prompt:
const enhancedPrompt = `Context from Wikipedia: ${context}\n\n${prompt}`;
```

## License

MIT
