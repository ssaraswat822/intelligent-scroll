import React, { useState, useRef, useCallback } from 'react';

/*
 * INTELLIGENT SCROLL
 * AI-powered social feed generator
 * 
 * GROQ API PROMPT STRATEGY:
 * - Uses Llama 3.3 70B for fast, high-quality generation
 * - Structured JSON output for reliable parsing
 * - Temperature 0.8 for creative but coherent content
 * 
 * WIKIPEDIA API NOTE:
 * To add educational content, you could enhance the serverless function to:
 * 1. Fetch Wikipedia summary: https://en.wikipedia.org/api/rest_v1/page/summary/{topic}
 * 2. Include the summary in the prompt for more factual posts
 * This would make posts more educational while keeping the social feel.
 * (Done server-side to avoid CORS issues)
 */

const App = () => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('discover');
  const [preloadedPosts, setPreloadedPosts] = useState([]);
  const [isPreloading, setIsPreloading] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPostingNew, setIsPostingNew] = useState(false);
  const inputRef = useRef(null);
  const currentTopicRef = useRef('');

  // Prompts for Groq API
  const createFeedPrompt = (searchTopic, existingHandles = []) => {
    const excludeHandles = existingHandles.length > 0 
      ? `\nDo NOT reuse these handles: ${existingHandles.join(', ')}` 
      : '';
    
    return `Generate 6 social media posts about "${searchTopic}".${excludeHandles}

Return ONLY a valid JSON array with this exact structure:
[{
  "id": "1",
  "author": {"name": "Full Name", "handle": "username.bsky.social"},
  "content": "Post text with optional #hashtags",
  "timestamp": "2h",
  "replies": 12,
  "reposts": 45,
  "likes": 234,
  "comments": [
    {"author": {"name": "Reply Name", "handle": "replier.bsky.social"}, "content": "Reply text", "timestamp": "1h", "likes": 5}
  ]
}]

Requirements:
- Each post needs unique realistic full name and handle
- Varied engagement numbers (some viral, some modest)
- Mix of tones: informative facts, hot takes, questions, personal stories, humor
- 3-4 posts should have 1-3 comments (thoughtful replies, debates, jokes)
- 2-3 posts should have empty comments array
- Make it feel like real people discussing "${searchTopic}"`;
  };

  const createCommentsPrompt = (postContent) => {
    return `A user posted this on social media:
"${postContent}"

Generate 3-5 realistic reply comments that provide context, reactions, or discussion.

Return ONLY a valid JSON array:
[{"author": {"name": "Full Name", "handle": "username.bsky.social"}, "content": "Reply text", "timestamp": "1m", "likes": 0}]

Make replies diverse:
- Someone agreeing and adding context
- Someone with a different perspective or question  
- Someone with a joke or observation
- Maybe someone sharing a related experience`;
  };

  // API call - works with both Netlify Functions and Claude API (for preview)
  const callAPI = async (prompt, type) => {
    // Try Netlify function first (production)
    try {
      const response = await fetch('/.netlify/functions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, type }),
      });
      
      if (response.ok) {
        const text = await response.text();
        return JSON.parse(text);
      }
    } catch (e) {
      // Netlify function not available, fall back to Claude API (artifact preview)
    }
    
    // Fallback to Claude API for artifact preview
    const systemPrompt = type === 'feed' 
      ? 'You are a social media content generator. Generate realistic social media posts in JSON format only. No markdown, no explanation, just valid JSON array.'
      : 'You are a social media comment generator. Generate realistic, thoughtful comments/replies in JSON format only. No markdown, no explanation, just valid JSON array.';
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    if (!response.ok) throw new Error('API request failed');
    
    const data = await response.json();
    const text = data.content.filter(i => i.type === 'text').map(i => i.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : clean);
  };

  const fetchPosts = async (searchTopic, existingHandles = []) => {
    const prompt = createFeedPrompt(searchTopic, existingHandles);
    return await callAPI(prompt, 'feed');
  };

  // Preload next batch
  const preloadNextBatch = useCallback(async (searchTopic, existingPosts) => {
    if (isPreloading) return;
    setIsPreloading(true);
    
    try {
      const existingHandles = existingPosts.map(p => p.author?.handle).filter(Boolean);
      const posts = await fetchPosts(searchTopic, existingHandles);
      const taggedPosts = posts.map((p, i) => ({ ...p, id: `preload-${Date.now()}-${i}` }));
      setPreloadedPosts(taggedPosts);
    } catch (err) {
      console.error('Preload error:', err);
    } finally {
      setIsPreloading(false);
    }
  }, [isPreloading]);

  const handleGenerate = async (topicToUse) => {
    const searchTopic = topicToUse || topic;
    if (!searchTopic.trim() || isLoading) return;
    
    setTopic(searchTopic);
    currentTopicRef.current = searchTopic;
    setIsLoading(true);
    setError('');
    setFeed([]);
    setPreloadedPosts([]);
    setAnimationKey(k => k + 1);

    try {
      const posts = await fetchPosts(searchTopic);
      setFeed(posts);
      setTimeout(() => preloadNextBatch(searchTopic, posts), 1000);
    } catch (err) {
      setError(`Failed to generate: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (preloadedPosts.length > 0) {
      const newFeed = [...feed, ...preloadedPosts];
      setFeed(newFeed);
      setPreloadedPosts([]);
      setAnimationKey(k => k + 1);
      setTimeout(() => preloadNextBatch(currentTopicRef.current, newFeed), 500);
    }
  };

  // Handle new post submission
  const handleNewPost = async () => {
    if (!newPostContent.trim() || isPostingNew) return;
    
    setIsPostingNew(true);
    try {
      const comments = await callAPI(createCommentsPrompt(newPostContent), 'comments');
      
      const newPost = {
        id: `user-${Date.now()}`,
        author: { name: 'You', handle: 'you.bsky.social' },
        content: newPostContent,
        timestamp: 'now',
        replies: comments.length,
        reposts: 0,
        likes: 0,
        comments: comments,
        isUserPost: true,
      };
      
      setFeed([newPost, ...feed]);
      setNewPostContent('');
      setShowNewPost(false);
      setAnimationKey(k => k + 1);
    } catch (err) {
      setError(`Failed to generate comments: ${err.message}`);
    } finally {
      setIsPostingNew(false);
    }
  };

  // Skeleton Component
  const SkeletonPost = () => (
    <div className="post skeleton-post">
      <div className="skeleton skeleton-avatar"></div>
      <div className="post-body">
        <div className="post-meta">
          <div className="skeleton skeleton-name"></div>
          <div className="skeleton skeleton-handle"></div>
        </div>
        <div className="skeleton skeleton-content"></div>
        <div className="skeleton skeleton-content-2"></div>
        <div className="post-actions">
          <div className="skeleton skeleton-action"></div>
          <div className="skeleton skeleton-action"></div>
          <div className="skeleton skeleton-action"></div>
        </div>
      </div>
    </div>
  );

  // Post Component
  const Post = ({ post, index }) => {
    const [liked, setLiked] = useState(false);
    const [reposted, setReposted] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showComments, setShowComments] = useState(post.isUserPost || false);
    
    const name = post.author?.name || 'Anonymous';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#22d3d8', '#60a5fa', '#a78bfa', '#f472b6'];
    const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    const bgColor = post.isUserPost ? '#1185fe' : colors[colorIndex];
    
    const comments = post.comments || [];
    const hasComments = comments.length > 0;

    return (
      <div className={`post post-animate ${post.isUserPost ? 'user-post' : ''}`} style={{ animationDelay: `${index * 80}ms` }}>
        <div className="post-avatar" style={{ background: bgColor }}>
          {initials}
        </div>
        <div className="post-body">
          <div className="post-meta">
            <span className="post-name">{post.author?.name}</span>
            <span className="post-handle">@{post.author?.handle}</span>
            <span className="post-dot">·</span>
            <span className="post-time">{post.timestamp}</span>
          </div>
          <div className="post-content">{post.content}</div>
          <div className="post-actions">
            <button 
              className={`action ${hasComments ? 'has-comments' : ''}`}
              onClick={() => hasComments && setShowComments(!showComments)}
              style={{ cursor: hasComments ? 'pointer' : 'default' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              <span>{comments.length || post.replies || 0}</span>
            </button>
            <button className={`action ${reposted ? 'reposted' : ''}`} onClick={() => setReposted(!reposted)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
              <span>{reposted ? (post.reposts || 0) + 1 : post.reposts || 0}</span>
            </button>
            <button className={`action ${liked ? 'liked' : ''}`} onClick={() => setLiked(!liked)}>
              <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span>{liked ? (post.likes || 0) + 1 : post.likes || 0}</span>
            </button>
            <button className={`action save ${saved ? 'saved' : ''}`} onClick={() => setSaved(!saved)}>
              <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button className="action">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="1.5"/><circle cx="6" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>
              </svg>
            </button>
          </div>
          
          {showComments && hasComments && (
            <div className="comments-section">
              {comments.map((comment, i) => {
                const cName = comment.author?.name || 'User';
                const cInitials = cName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const cColorIndex = cName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
                
                return (
                  <div key={i} className="comment">
                    <div className="comment-avatar" style={{ background: colors[cColorIndex] }}>
                      {cInitials}
                    </div>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <span className="comment-name">{comment.author?.name}</span>
                        <span className="comment-handle">@{comment.author?.handle}</span>
                        <span className="comment-time">· {comment.timestamp}</span>
                      </div>
                      <div className="comment-content">{comment.content}</div>
                      <div className="comment-actions">
                        <span>💬 Reply</span>
                        <span>❤️ {comment.likes || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const NavItem = ({ icon, label, active, onClick }) => (
    <a href="#" className={`nav-item ${active ? 'active' : ''}`} onClick={e => { e.preventDefault(); onClick?.(); }}>
      {icon}
      <span>{label}</span>
    </a>
  );

  const trending = ['Artificial Intelligence', 'Climate Change', 'Space Exploration', 'Quantum Computing', 'Renewable Energy'];

  return (
    <div className="app">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        .app {
          display: flex;
          justify-content: center;
          min-height: 100vh;
          background: #f3f3f8;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .layout { display: flex; width: 100%; max-width: 1200px; }

        .sidebar-left {
          width: 240px;
          padding: 10px;
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          margin-bottom: 8px;
        }

        .logo-icon {
          width: 38px;
          height: 38px;
          background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .logo-text {
          font-weight: 700;
          font-size: 17px;
          color: #111;
          line-height: 1.2;
        }

        .logo-text span {
          display: block;
          font-weight: 400;
          font-size: 11px;
          color: #666;
        }

        .nav { display: flex; flex-direction: column; gap: 2px; }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 8px;
          text-decoration: none;
          color: #333;
          font-size: 15px;
          font-weight: 500;
          transition: background 0.15s;
        }

        .nav-item:hover { background: #e8e8ed; }
        .nav-item.active { font-weight: 600; }
        .nav-item svg { width: 22px; height: 22px; stroke-width: 2; }

        .new-post-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 12px;
          padding: 14px 20px;
          background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%);
          color: white;
          border: none;
          border-radius: 24px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
        }

        .new-post-btn:hover { opacity: 0.9; }
        .new-post-btn svg { width: 18px; height: 18px; }

        .sidebar-spacer { flex: 1; }

        .creator-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          margin-bottom: 10px;
          color: #666;
          text-decoration: none;
          font-size: 13px;
          border-radius: 8px;
          transition: all 0.15s;
        }

        .creator-link:hover {
          background: #e8e8ed;
          color: #1185fe;
        }

        .main-feed {
          flex: 1;
          max-width: 600px;
          border-left: 1px solid #e4e4e9;
          border-right: 1px solid #e4e4e9;
          background: white;
          min-height: 100vh;
        }

        .feed-header {
          position: sticky;
          top: 0;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid #e4e4e9;
          z-index: 10;
        }

        .feed-logo {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          padding: 14px;
          border-bottom: 1px solid #e4e4e9;
          font-weight: 700;
          font-size: 18px;
          color: #111;
        }

        .feed-logo-icon {
          font-size: 24px;
        }

        .feed-tabs { display: flex; }

        .feed-tab {
          flex: 1;
          padding: 14px;
          text-align: center;
          font-size: 14px;
          font-weight: 500;
          color: #666;
          cursor: pointer;
          border-bottom: 2px solid transparent;
        }

        .feed-tab:hover { background: #f8f8fa; }
        .feed-tab.active { color: #1185fe; border-bottom-color: #1185fe; font-weight: 600; }

        .topic-input-section {
          padding: 12px 16px;
          border-bottom: 1px solid #e4e4e9;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .topic-avatar {
          width: 42px;
          height: 42px;
          background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: white;
          font-weight: bold;
          font-size: 18px;
        }

        .topic-input-wrapper { flex: 1; display: flex; gap: 10px; }

        .topic-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #ddd;
          border-radius: 20px;
          font-size: 15px;
          outline: none;
        }

        .topic-input:focus { border-color: #1185fe; }

        .generate-btn {
          padding: 10px 18px;
          background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%);
          color: white;
          border: none;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          min-width: 100px;
        }

        .generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .generate-btn:hover:not(:disabled) { opacity: 0.9; }

        .posts { }

        .post {
          display: flex;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid #e4e4e9;
        }

        .post:hover { background: #fafafa; }
        
        .post.user-post {
          background: #f0f7ff;
          border-left: 3px solid #1185fe;
        }

        .post-animate {
          animation: fadeIn 0.35s ease both;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .post-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #60a5fa;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 15px;
        }

        .post-body { flex: 1; min-width: 0; }
        .post-meta { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; flex-wrap: wrap; }
        .post-name { font-weight: 600; font-size: 15px; color: #111; }
        .post-handle { font-size: 14px; color: #666; }
        .post-dot { color: #666; }
        .post-time { font-size: 14px; color: #666; }

        .post-content {
          font-size: 15px;
          line-height: 1.5;
          color: #111;
          margin-bottom: 12px;
          white-space: pre-wrap;
        }

        .post-actions { display: flex; gap: 2px; margin-left: -8px; }

        .action {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: none;
          border: none;
          border-radius: 20px;
          color: #666;
          font-size: 13px;
          cursor: pointer;
        }

        .action:hover { background: #f0f0f5; }
        .action svg { width: 18px; height: 18px; }
        .action.liked { color: #ec4899; }
        .action.reposted { color: #22c55e; }
        .action.saved { color: #1185fe; }
        .action.save { margin-left: auto; }
        .action.save span, .action:last-child span { display: none; }
        .action.has-comments { color: #1185fe; }
        .action.has-comments:hover { background: #e8f4ff; }

        .comments-section {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e4e4e9;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .comment {
          display: flex;
          gap: 10px;
          animation: fadeIn 0.25s ease;
        }

        .comment-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 12px;
          flex-shrink: 0;
        }

        .comment-body { flex: 1; min-width: 0; }
        .comment-meta { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 2px; }
        .comment-name { font-weight: 600; font-size: 14px; color: #111; }
        .comment-handle { font-size: 13px; color: #666; }
        .comment-time { font-size: 13px; color: #888; }
        .comment-content { font-size: 14px; line-height: 1.45; color: #222; }
        .comment-actions { display: flex; gap: 16px; margin-top: 6px; font-size: 12px; color: #666; }
        .comment-actions span { cursor: pointer; }
        .comment-actions span:hover { color: #1185fe; }

        .skeleton-post { pointer-events: none; }
        .skeleton {
          background: linear-gradient(90deg, #eee 25%, #ddd 50%, #eee 75%);
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite;
          border-radius: 4px;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .skeleton-avatar { width: 44px; height: 44px; border-radius: 50%; }
        .skeleton-name { width: 90px; height: 14px; display: inline-block; }
        .skeleton-handle { width: 120px; height: 14px; display: inline-block; margin-left: 8px; }
        .skeleton-content { width: 100%; height: 14px; margin: 10px 0 6px; }
        .skeleton-content-2 { width: 70%; height: 14px; margin-bottom: 14px; }
        .skeleton-action { width: 45px; height: 22px; border-radius: 11px; margin-right: 8px; }

        .load-more-section {
          padding: 20px;
          text-align: center;
          border-bottom: 1px solid #e4e4e9;
        }

        .load-more-btn {
          padding: 12px 28px;
          background: white;
          border: 1.5px solid #1185fe;
          color: #1185fe;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .load-more-btn:hover:not(:disabled) { background: #1185fe; color: white; }
        .load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .preload-status { font-size: 12px; color: #22c55e; margin-top: 8px; }
        .preload-status.loading { color: #666; }

        .error {
          margin: 16px;
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 14px;
        }

        .empty-state { padding: 48px 24px; text-align: center; }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
        .empty-title { font-size: 18px; font-weight: 600; color: #333; margin-bottom: 8px; }
        .empty-text { font-size: 14px; color: #666; margin-bottom: 20px; }
        .suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }

        .chip {
          padding: 8px 14px;
          background: #f3f3f8;
          border: 1px solid #e4e4e9;
          border-radius: 20px;
          font-size: 13px;
          color: #333;
          cursor: pointer;
        }

        .chip:hover { background: #e8f4ff; border-color: #1185fe; color: #1185fe; }

        .sidebar-right {
          width: 320px;
          padding: 10px 16px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: #ebebf0;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .search-box svg { width: 18px; height: 18px; color: #666; flex-shrink: 0; }
        .search-box input { flex: 1; border: none; background: none; font-size: 14px; outline: none; }

        .sidebar-section {
          background: #f8f8fa;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 16px;
        }

        .sidebar-title { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 12px; }

        .trending-item {
          display: flex;
          gap: 10px;
          padding: 8px 0;
          font-size: 14px;
          color: #333;
          cursor: pointer;
        }

        .trending-item:hover { color: #1185fe; }
        .trending-num { color: #888; width: 18px; }

        .footer { font-size: 12px; color: #888; padding: 16px 0; }
        .footer a { color: #888; text-decoration: none; margin-right: 12px; }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }

        .modal {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e4e4e9;
        }

        .modal-title { font-size: 18px; font-weight: 600; }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          line-height: 1;
        }

        .modal-body { padding: 20px; }

        .modal-section { margin-bottom: 20px; }
        .modal-section:last-child { margin-bottom: 0; }
        .modal-section h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #333; }
        .modal-section p { font-size: 14px; color: #555; line-height: 1.6; }
        .modal-section ul { font-size: 14px; color: #555; line-height: 1.8; padding-left: 20px; }

        .new-post-textarea {
          width: 100%;
          min-height: 120px;
          padding: 14px;
          border: 1px solid #ddd;
          border-radius: 12px;
          font-size: 15px;
          font-family: inherit;
          resize: vertical;
          outline: none;
        }

        .new-post-textarea:focus { border-color: #1185fe; }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 16px;
        }

        .modal-btn {
          padding: 10px 20px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .modal-btn.secondary {
          background: #f3f3f8;
          border: 1px solid #ddd;
          color: #333;
        }

        .modal-btn.primary {
          background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%);
          border: none;
          color: white;
        }

        .modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (max-width: 1000px) { .sidebar-right { display: none; } }
        @media (max-width: 700px) {
          .sidebar-left { width: 60px; }
          .sidebar-left .nav-item span, .new-post-btn span, .logo-text, .creator-link span { display: none; }
          .new-post-btn { padding: 14px; border-radius: 50%; }
          .logo { justify-content: center; }
          .creator-link { justify-content: center; }
        }
      `}</style>

      <div className="layout">
        <aside className="sidebar-left">
          <div className="logo">
            <div className="logo-icon">🧠</div>
            <div className="logo-text">
              Intelligent Scroll
              <span>AI-Powered Feed</span>
            </div>
          </div>
          
          <nav className="nav">
            <NavItem active icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} label="Home" />
            <NavItem icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>} label="Explore" />
            <NavItem 
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} 
              label="How to Use" 
              onClick={() => setShowHowTo(true)}
            />
            <NavItem icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>} label="Saved" />
            <NavItem icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>} label="Settings" />
          </nav>
          
          <div className="sidebar-spacer"></div>
          
          <a href="https://sudsaraswat.com" target="_blank" rel="noopener noreferrer" className="creator-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span>Made by Sud</span>
          </a>
          
          <button className="new-post-btn" onClick={() => setShowNewPost(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>New Post</span>
          </button>
        </aside>

        <main className="main-feed">
          <header className="feed-header">
            <div className="feed-logo">
              <span className="feed-logo-icon">🧠</span>
              Intelligent Scroll
            </div>
            <div className="feed-tabs">
              <div className={`feed-tab ${activeTab === 'discover' ? 'active' : ''}`} onClick={() => setActiveTab('discover')}>Discover</div>
              <div className={`feed-tab ${activeTab === 'following' ? 'active' : ''}`} onClick={() => setActiveTab('following')}>Following</div>
              <div className={`feed-tab ${activeTab === 'trending' ? 'active' : ''}`} onClick={() => setActiveTab('trending')}>Trending</div>
            </div>
          </header>

          <div className="topic-input-section">
            <div className="topic-avatar">🔍</div>
            <div className="topic-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                className="topic-input"
                placeholder="Enter a topic to explore..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate(topic)}
                disabled={isLoading}
              />
              <button className="generate-btn" onClick={() => handleGenerate(topic)} disabled={isLoading || !topic.trim()}>
                {isLoading ? 'Loading...' : 'Generate'}
              </button>
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="posts" key={animationKey}>
            {feed.map((post, i) => (
              <Post key={post.id || i} post={post} index={i} />
            ))}
            {isLoading && 
              [...Array(6)].map((_, i) => (
                <SkeletonPost key={`skeleton-${i}`} />
              ))
            }
          </div>

          {feed.length > 0 && !isLoading && (
            <div className="load-more-section">
              <button 
                className="load-more-btn"
                onClick={handleLoadMore}
                disabled={preloadedPosts.length === 0 && !isPreloading}
              >
                {preloadedPosts.length > 0 ? 'Load More' : 'Preparing...'}
              </button>
              {preloadedPosts.length > 0 && (
                <div className="preload-status">✓ {preloadedPosts.length} posts ready</div>
              )}
              {isPreloading && (
                <div className="preload-status loading">Loading next batch...</div>
              )}
            </div>
          )}

          {!isLoading && feed.length === 0 && !error && (
            <div className="empty-state">
              <div className="empty-icon">🧠</div>
              <h2 className="empty-title">Intelligent Scroll</h2>
              <p className="empty-text">Enter any topic to generate an AI-powered discussion feed, or create your own post!</p>
              <div className="suggestions">
                {['Black holes', 'Renaissance art', 'Jazz history', 'Climate solutions'].map(s => (
                  <button key={s} className="chip" onClick={() => handleGenerate(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
        </main>

        <aside className="sidebar-right">
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" placeholder="Search topics..." />
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">🔥 Trending Topics</div>
            <div className="trending-list">
              {trending.map((item, i) => (
                <div key={i} className="trending-item" onClick={() => handleGenerate(item)}>
                  <span className="trending-num">{i + 1}.</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">ℹ️ About</div>
            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
              Intelligent Scroll uses AI to generate realistic social media discussions on any topic. 
              Powered by Groq's ultra-fast Llama models.
            </p>
          </div>

          <div className="footer">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">About</a>
          </div>
        </aside>
      </div>

      {/* How to Use Modal */}
      {showHowTo && (
        <div className="modal-overlay" onClick={() => setShowHowTo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📖 How to Use Intelligent Scroll</span>
              <button className="modal-close" onClick={() => setShowHowTo(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="modal-section">
                <h3>🔍 Explore Any Topic</h3>
                <p>Type any topic in the search bar and click "Generate" to create an AI-powered feed of realistic social media posts and discussions about that topic.</p>
              </div>
              <div className="modal-section">
                <h3>✍️ Create Your Own Post</h3>
                <p>Click "New Post" in the sidebar to write your own post. AI will automatically generate thoughtful comments and replies, giving you instant feedback and different perspectives!</p>
              </div>
              <div className="modal-section">
                <h3>💬 Join the Discussion</h3>
                <p>Posts with comments have a blue reply count. Click it to expand the thread and see different viewpoints, questions, and reactions.</p>
              </div>
              <div className="modal-section">
                <h3>⚡ Tips</h3>
                <ul>
                  <li>Be specific with topics for better results (e.g., "quantum entanglement" vs "physics")</li>
                  <li>Try trending topics for popular discussions</li>
                  <li>Your posts appear at the top with a blue highlight</li>
                  <li>Click "Load More" for infinite scrolling</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Post Modal */}
      {showNewPost && (
        <div className="modal-overlay" onClick={() => !isPostingNew && setShowNewPost(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">✍️ Create a Post</span>
              <button className="modal-close" onClick={() => !isPostingNew && setShowNewPost(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                Write anything and AI will generate thoughtful comments and replies!
              </p>
              <textarea
                className="new-post-textarea"
                placeholder="What's on your mind? Share a thought, question, or hot take..."
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                disabled={isPostingNew}
              />
              <div className="modal-actions">
                <button className="modal-btn secondary" onClick={() => setShowNewPost(false)} disabled={isPostingNew}>
                  Cancel
                </button>
                <button className="modal-btn primary" onClick={handleNewPost} disabled={!newPostContent.trim() || isPostingNew}>
                  {isPostingNew ? 'Generating comments...' : 'Post & Generate Comments'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
