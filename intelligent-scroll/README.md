# Intelligent Scroll

Type in a subject. Get a social timeline about it — facts, arguments, replies, explainers — that keeps
writing itself as long as you keep scrolling.

It looks like a Twitter/X feed, except every account on it is writing about the thing you asked for.

## What it does

- **Any subject.** Search a science, a war, a food, a person, or click a follow-up question on any post
  to spin off a whole new feed.
- **It doesn't end.** Batches are generated ahead of the reader and released as you approach the bottom.
  Each batch is pushed through a different lens (origins, misconceptions, open questions, failures, the
  money, what's next, and a dozen more) and is told what has already been posted, so the timeline keeps
  finding new ground instead of restating its own greatest hits.
- **Grounded.** Wikipedia is fetched for the subject and used as reference material for generation, and
  shown as a source card at the top of the feed.
- **Conversation, not a listicle.** Posts carry replies that disagree with each other. Reply to any post
  and the personas reply back. Post your own take from the composer and the timeline responds to that.
- **Deep dives.** Any post expands into a long-form version, written on demand.
- **Tunable.** A depth slider runs from group-chat to peer-review, and you choose which personas show up.
- **Feed mechanics you'd expect.** Kind tabs (facts / debate / explainers), bookmarks, likes, reposts,
  light and dark themes, deep links (`/?q=black+holes`), and keyboard shortcuts.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus search |
| `n` | Compose a post |
| `r` | Random subject |
| `j` / `k` | Next / previous post |
| `Esc` | Close dialogs |

## Running it

```bash
npm install
cp .env.example .env      # add a GROQ_API_KEY
npm run dev               # http://localhost:5173
```

`npm run dev` serves the `/api/generate` endpoint itself through a Vite middleware, so the Netlify CLI is
not needed for local development. If you'd rather run the real function, `netlify dev` also works.

### Demo mode

Without an API key the app still runs. It assembles the feed from the Wikipedia article for the subject
plus discussion templates, and says so in a banner. Nothing is fabricated in this mode: the factual
sentences come verbatim from Wikipedia and the rest is framing and argument. It exists so the app is never
a dead screen — and so you can try it before wiring up a provider.

## Providers

Set one of these and the app picks it up automatically:

| Variable | Default model | Notes |
| --- | --- | --- |
| `GROQ_API_KEY` | `llama-3.3-70b-versatile` | Recommended. Fast enough to finish a batch inside Netlify's 10s function limit. |
| `ANTHROPIC_API_KEY` | `claude-3-5-haiku-latest` | Better prose, slower. |
| `OPENAI_API_KEY` | `gpt-4o-mini` | |

Override with `AI_PROVIDER` (`groq` \| `anthropic` \| `openai`), and the model with `AI_MODEL` or a
provider-specific `GROQ_MODEL` / `ANTHROPIC_MODEL` / `OPENAI_MODEL`.

Keys are only ever read server-side, in the Netlify function or the dev middleware. They are never sent to
the browser.

## Deploying to Netlify

1. Push this repo to GitHub and import it at [app.netlify.com](https://app.netlify.com).
2. Build command `npm run build`, publish directory `dist`. Both are already in `netlify.toml`, along with
   the `/api/*` → `/.netlify/functions/*` redirect.
3. Add `GROQ_API_KEY` under **Site settings → Environment variables**.
4. Deploy.

> Netlify's synchronous functions time out at 10 seconds. That's why a batch is six posts and why deep
> dives are generated on demand rather than bundled into every batch. If you switch to a slower provider
> and start seeing timeouts, lower `BATCH_SIZE` in `src/hooks/useInfiniteFeed.js`.

## How the endless feed works

`src/hooks/useInfiniteFeed.js` is the interesting part.

- A **session** holds the subject, its Wikipedia context, a batch counter, a set of content signatures,
  and a rolling list of what has already been posted.
- The **pump** generates batches until two are queued ahead of the reader, and only one pump ever runs at
  a time. Failures back off and retry; three consecutive failures surface a retry button rather than
  silently ending the feed.
- Every post is checked against two **signatures** — its opening text and a bag of its rarest words — so
  the same fact reworded gets dropped instead of appearing twice.
- **Lens rotation** (`src/lib/prompt.js`) gives each batch a different set of angles to cover, and the
  prompt carries the last eighteen posts as ground to avoid.
- Responses are parsed **tolerantly** (`src/lib/parse.js`): a reply truncated mid-array still yields every
  object that finished, so a token limit slows the feed instead of breaking it.
- Delivery is driven by both a scroll listener and a low-frequency interval. The interval matters: if a
  batch finishes while the reader is already sitting at the bottom, no scroll event would ever fire to
  release it.

## Project structure

```
intelligent-scroll/
├── index.html
├── netlify/functions/generate.js   # serverless endpoint
├── shared/ai.js                    # provider calls, shared with the dev middleware
├── vite.config.js                  # includes the dev /api/generate middleware
└── src/
    ├── App.jsx                     # layout, routing, scroll watcher, shortcuts
    ├── hooks/useInfiniteFeed.js    # the feed engine
    ├── components/                 # Post, Composer, rails, modals, icons
    ├── lib/
    │   ├── api.js                  # /api/generate + Wikipedia clients
    │   ├── prompt.js               # prompts, lenses, tone levels
    │   ├── parse.js                # tolerant JSON extraction
    │   ├── offline.js              # demo-mode generator
    │   ├── personas.js
    │   ├── topics.js
    │   └── util.js
    └── styles.css
```

## License

MIT
