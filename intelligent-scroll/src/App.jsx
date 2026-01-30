import React, { useState, useRef, useCallback } from 'react';

const App = () => {
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('discover');
  const [preloadedPosts, setPreloadedPosts] = useState([]);
  const [isPreloading, setIsPreloading] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPostingNew, setIsPostingNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [educationLevel, setEducationLevel] = useState(7);
  const [expandedPosts, setExpandedPosts] = useState(new Set());
  const inputRef = useRef(null);
  const currentTopicRef = useRef('');

  // Fetch topic-relevant images from Pexels via serverless function
  const fetchTopicImages = async (query) => {
    try {
      const response = await fetch('/.netlify/functions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'image', query }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.images || [];
      }
    } catch (e) {
      console.log('Image fetch failed:', e);
    }
    return [];
  };

  // Random educational topics for Explore
  const exploreTopic = () => {
    const topics = [
      'How vaccines work', 'The history of coffee', 'Black holes explained', 'Why we dream',
      'The science of music', 'How planes fly', 'Ancient Roman engineering', 'The human microbiome',
      'Cryptocurrency basics', 'Climate change solutions', 'The psychology of habits', 'Space exploration milestones',
      'How the internet works', 'The history of democracy', 'Renewable energy types', 'Animal intelligence',
      'The science of cooking', 'How memory works', 'Ocean ecosystems', 'The history of writing',
      'Quantum computing basics', 'How languages evolve', 'The science of sleep', 'Artificial intelligence ethics',
      'Biodiversity importance', 'The history of mathematics', 'How batteries work', 'The psychology of color',
      'Sustainable agriculture', 'The human brain', 'Evolution explained', 'The history of medicine'
    ];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    handleGenerate(randomTopic);
  };

  const getEducationPromptModifier = () => {
    if (educationLevel <= 3) {
      return `TONE: Keep it casual and fun! Mix entertainment with light facts. Think viral tweets - punchy, relatable, sometimes funny. Only 1-2 posts need specific facts, the rest can be opinions, jokes, or personal takes.`;
    } else if (educationLevel <= 6) {
      return `TONE: Balance entertainment and education. Mix interesting facts with personal perspectives and occasional humor. Think popular science YouTube - accessible but informative.`;
    } else {
      return `TONE: Think Neil deGrasse Tyson, Hank Green, or a passionate professor sharing cool stuff - enthusiastic but deeply informative. Posts should make people feel like they learned something valuable. Prioritize specific facts, data, and expert insights.`;
    }
  };

  const createFeedPrompt = (searchTopic, existingHandles = []) => {
    const excludeHandles = existingHandles.length > 0 ? `\nDo NOT reuse these handles: ${existingHandles.join(', ')}` : '';
    const toneModifier = getEducationPromptModifier();
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

${toneModifier}

CONTENT MIX:
- Include specific facts, numbers, or dates when relevant
- Mix different perspectives and tones
- Make it feel like real people discussing "${searchTopic}"

AVOID: Vague statements that could apply to any topic. Be SPECIFIC to "${searchTopic}".

OTHER REQUIREMENTS:
- Each post needs unique realistic full name and handle
- Varied engagement numbers
- 3-4 posts should have 1-3 comments
- 2-3 posts should have empty comments array
- Comments should be substantive`;
  };

  const createCommentsPrompt = (postContent) => {
    return `A user posted this on social media:
"${postContent}"

Generate 3-5 substantive reply comments that add value to the discussion.

Return ONLY a valid JSON array:
[{"author": {"name": "Full Name", "handle": "username.bsky.social"}, "content": "Reply text", "timestamp": "1m", "likes": 0}]

Make replies EDUCATIONAL and SUBSTANTIVE:
- Someone adding a related fact, statistic, or piece of context that enriches the original post
- Someone asking a thoughtful follow-up question that goes deeper
- Someone offering a different perspective backed by reasoning or evidence
- Someone sharing relevant expertise or firsthand knowledge
- Maybe one lighter comment (joke or observation) but still on-topic

AVOID generic responses like "Great post!" or "So true!" - every comment should add information or provoke thought.`;
  };

  const createReplyPrompt = (originalComment, userReply) => {
    return `In a social media thread, someone commented:
"${originalComment}"

The user replied:
"${userReply}"

Generate 1-2 follow-up responses from other users that continue this specific conversation thread naturally.

Return ONLY a valid JSON array:
[{"author": {"name": "Full Name", "handle": "username.bsky.social"}, "content": "Reply text", "timestamp": "just now", "likes": 0}]

Make the responses:
- Directly address what the user said
- Add new information, ask a follow-up question, or offer a different angle
- Feel like a natural continuation of the conversation
- Be substantive, not generic`;
  };

  const callAPI = async (prompt, type) => {
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
      console.log('Netlify function not available');
    }
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
    setExpandedPosts(new Set());
    try {
      // Fetch posts and images in parallel
      const [posts, images] = await Promise.all([
        fetchPosts(searchTopic),
        fetchTopicImages(searchTopic)
      ]);
      
      // Add images to posts (positions 1 and 4) if we have images
      const postsWithImages = posts.map((post, i) => {
        if (images.length > 0 && (i === 1 || i === 4)) {
          const imageIndex = i === 1 ? 0 : Math.min(1, images.length - 1);
          return { ...post, image: images[imageIndex] };
        }
        return post;
      });
      setFeed(postsWithImages);
      setTimeout(() => preloadNextBatch(searchTopic, postsWithImages), 1000);
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
      setTimeout(() => preloadNextBatch(currentTopicRef.current, newFeed), 500);
    }
  };

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
      // Insert at a natural position (2nd or 3rd spot if feed exists, otherwise first)
      const insertPosition = feed.length >= 3 ? Math.floor(Math.random() * 2) + 1 : 0;
      const newFeed = [...feed];
      newFeed.splice(insertPosition, 0, newPost);
      setFeed(newFeed);
      setNewPostContent('');
      setShowNewPost(false);
    } catch (err) {
      setError(`Failed to generate comments: ${err.message}`);
    } finally {
      setIsPostingNew(false);
    }
  };

  const handleAddReplies = async (postId, commentIndex, originalContent, userReply) => {
    // Auto-expand this post so user sees their reply
    setExpandedPosts(prev => new Set(prev).add(postId));
    
    const userComment = {
      author: { name: 'You', handle: 'you.bsky.social' },
      content: userReply,
      timestamp: 'just now',
      likes: 0,
      isUser: true
    };
    
    // If commentIndex is -1, this is a new top-level comment on the post
    if (commentIndex === -1) {
      setFeed(currentFeed => currentFeed.map(post => {
        if (post.id === postId) {
          const newComments = [...(post.comments || []), userComment];
          return { ...post, comments: newComments };
        }
        return post;
      }));
    } else {
      // This is a reply to an existing comment
      setFeed(currentFeed => currentFeed.map(post => {
        if (post.id === postId) {
          const newComments = [...post.comments];
          newComments.splice(commentIndex + 1, 0, userComment);
          return { ...post, comments: newComments };
        }
        return post;
      }));
    }

    try {
      const prompt = createReplyPrompt(originalContent, userReply);
      const aiReplies = await callAPI(prompt, 'comments');
      
      setFeed(currentFeed => currentFeed.map(post => {
        if (post.id === postId) {
          const newComments = [...post.comments];
          // Find the user's comment and add AI replies after it
          const userCommentIndex = newComments.findIndex(c => c.isUser && c.content === userReply);
          if (userCommentIndex !== -1) {
            newComments.splice(userCommentIndex + 1, 0, ...aiReplies);
          } else {
            newComments.push(...aiReplies);
          }
          return { ...post, comments: newComments };
        }
        return post;
      }));
      
      return aiReplies;
    } catch (err) {
      console.error('Failed to generate AI replies:', err);
      return [];
    }
  };

  const toggleExpandPost = useCallback((postId) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  }, []);

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

  const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#22d3d8', '#60a5fa', '#a78bfa', '#f472b6'];

  const Post = React.memo(function Post({ post, index, onAddReplies, isExpanded, onToggleExpand }) {
    const [liked, setLiked] = useState(false);
    const [reposted, setReposted] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const [newCommentText, setNewCommentText] = useState('');
    const [isAddingComment, setIsAddingComment] = useState(false);
    const name = post.author?.name || 'Anonymous';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    const bgColor = post.isUserPost ? '#1185fe' : colors[colorIndex];
    const comments = post.comments || [];
    const hasComments = comments.length > 0;
    const showComments = isExpanded || post.isUserPost;

    const handleReply = async (commentIndex, originalContent) => {
      if (!replyText.trim() || isReplying) return;
      setIsReplying(true);
      try {
        await onAddReplies(post.id, commentIndex, originalContent, replyText);
        setReplyText('');
        setReplyingTo(null);
      } catch (err) {
        console.error('Reply error:', err);
      } finally {
        setIsReplying(false);
      }
    };

    const handleNewComment = async () => {
      if (!newCommentText.trim() || isAddingComment) return;
      setIsAddingComment(true);
      try {
        await onAddReplies(post.id, -1, post.content, newCommentText);
        setNewCommentText('');
      } catch (err) {
        console.error('Comment error:', err);
      } finally {
        setIsAddingComment(false);
      }
    };

    return (
      <div className={`post ${post.isUserPost ? 'user-post' : ''}`} style={{ animation: 'fadeIn 0.4s ease forwards', animationDelay: `${index * 80}ms` }}>
        <div className="post-avatar" style={{ background: bgColor }}>{initials}</div>
        <div className="post-body">
          <div className="post-meta">
            <span className="post-name">{post.author?.name}</span>
            <span className="post-handle">@{post.author?.handle}</span>
            <span className="post-dot">·</span>
            <span className="post-time">{post.timestamp}</span>
          </div>
          <div className="post-content">{post.content}</div>
          {post.image && post.image.url && (
            <div className="post-image-container">
              <img src={post.image.url} alt={post.image.alt || 'Post image'} className="post-image" loading="lazy" />
              {post.image.photographer && <span className="photo-credit">📷 {post.image.photographer}</span>}
            </div>
          )}
          <div className="post-actions">
            <button className={`action ${hasComments ? 'has-comments' : ''}`} onClick={() => onToggleExpand(post.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span>{comments.length || 0}</span>
            </button>
            <button className={`action ${reposted ? 'reposted' : ''}`} onClick={() => setReposted(!reposted)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              <span>{reposted ? (post.reposts || 0) + 1 : post.reposts || 0}</span>
            </button>
            <button className={`action ${liked ? 'liked' : ''}`} onClick={() => setLiked(!liked)}>
              <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span>{liked ? (post.likes || 0) + 1 : post.likes || 0}</span>
            </button>
            <button className="action">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="1.5"/><circle cx="6" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>
            </button>
          </div>
          {showComments && (
            <div className="comments-section">
              {comments.map((comment, i) => {
                const cName = comment.author?.name || 'User';
                const cInitials = cName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const cColorIndex = cName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
                const isUserComment = comment.isUser || comment.author?.name === 'You';
                return (
                  <div key={i} className={`comment ${isUserComment ? 'user-comment' : ''}`}>
                    <div className="comment-avatar" style={{ background: isUserComment ? '#1185fe' : colors[cColorIndex] }}>{cInitials}</div>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <span className="comment-name">{comment.author?.name}</span>
                        <span className="comment-handle">@{comment.author?.handle}</span>
                        <span className="comment-time">· {comment.timestamp}</span>
                      </div>
                      <div className="comment-content">{comment.content}</div>
                      <div className="comment-actions">
                        <span onClick={() => setReplyingTo(replyingTo === i ? null : i)} style={{ color: replyingTo === i ? '#1185fe' : undefined }}>💬 Reply</span>
                        <span>❤️ {comment.likes || 0}</span>
                      </div>
                      {replyingTo === i && (
                        <div className="reply-input-section">
                          <input 
                            type="text" 
                            className="reply-input" 
                            placeholder="Write a reply..." 
                            value={replyText} 
                            onChange={e => setReplyText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleReply(i, comment.content)}
                            disabled={isReplying}
                            autoFocus
                          />
                          <button className="reply-btn" onClick={() => handleReply(i, comment.content)} disabled={!replyText.trim() || isReplying}>
                            {isReplying ? '...' : 'Reply'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="new-comment-section">
                <input 
                  type="text" 
                  className="reply-input" 
                  placeholder={hasComments ? "Add to the discussion..." : "Start a discussion..."} 
                  value={newCommentText} 
                  onChange={e => setNewCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNewComment()}
                  disabled={isAddingComment}
                />
                <button className="reply-btn" onClick={handleNewComment} disabled={!newCommentText.trim() || isAddingComment}>
                  {isAddingComment ? '...' : 'Comment'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  });

  const NavItem = ({ icon, label, active, onClick }) => (
    <a href="#" className={`nav-item ${active ? 'active' : ''}`} onClick={e => { e.preventDefault(); onClick?.(); }}>{icon}<span>{label}</span></a>
  );

  const trending = ['Artificial Intelligence', 'Climate Change', 'Space Exploration', 'Quantum Computing', 'Renewable Energy'];

  return (
    <div className="app">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { overflow-x: hidden; width: 100%; }
        .app { display: flex; justify-content: center; min-height: 100vh; background: #f3f3f8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; width: 100%; max-width: 100vw; overflow-x: hidden; }
        .layout { display: flex; width: 100%; max-width: 1200px; overflow-x: hidden; }
        .sidebar-left { width: 240px; padding: 10px; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; }
        .logo { display: flex; align-items: center; gap: 10px; padding: 12px 14px; margin-bottom: 8px; }
        .logo-icon { width: 38px; height: 38px; background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .logo-text { font-weight: 700; font-size: 17px; color: #111; line-height: 1.2; }
        .logo-text span { display: block; font-weight: 400; font-size: 11px; color: #666; }
        .nav { display: flex; flex-direction: column; gap: 2px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 8px; text-decoration: none; color: #333; font-size: 15px; font-weight: 500; transition: background 0.15s; }
        .nav-item:hover { background: #e8e8ed; }
        .nav-item.active { font-weight: 600; }
        .nav-item svg { width: 22px; height: 22px; stroke-width: 2; }
        .new-post-btn { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; padding: 14px 20px; background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%); color: white; border: none; border-radius: 24px; font-size: 15px; font-weight: 600; cursor: pointer; }
        .new-post-btn:hover { opacity: 0.9; }
        .new-post-btn svg { width: 18px; height: 18px; }
        .sidebar-spacer { flex: 1; }
        .creator-link { display: flex; align-items: center; gap: 10px; padding: 12px 14px; margin-bottom: 10px; color: #666; text-decoration: none; font-size: 13px; border-radius: 8px; transition: all 0.15s; }
        .creator-link:hover { background: #e8e8ed; color: #1185fe; }
        .main-feed { flex: 1; max-width: 600px; min-width: 0; border-left: 1px solid #e4e4e9; border-right: 1px solid #e4e4e9; background: white; min-height: 100vh; overflow-x: hidden; }
        .feed-header { position: sticky; top: 0; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border-bottom: 1px solid #e4e4e9; z-index: 10; }
        .feed-logo { display: flex; justify-content: center; align-items: center; gap: 8px; padding: 14px; border-bottom: 1px solid #e4e4e9; font-weight: 700; font-size: 18px; color: #111; }
        .feed-logo-icon { font-size: 24px; }
        .feed-tabs { display: flex; }
        .feed-tab { flex: 1; padding: 14px; text-align: center; font-size: 14px; font-weight: 500; color: #666; cursor: pointer; border-bottom: 2px solid transparent; }
        .feed-tab:hover { background: #f8f8fa; }
        .feed-tab.active { color: #1185fe; border-bottom-color: #1185fe; font-weight: 600; }
        .topic-input-section { padding: 12px 16px; border-bottom: 1px solid #e4e4e9; display: flex; gap: 12px; align-items: center; }
        .topic-avatar { width: 42px; height: 42px; background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: white; font-weight: bold; font-size: 18px; }
        .topic-input-wrapper { flex: 1; display: flex; gap: 10px; }
        .topic-input { flex: 1; padding: 10px 14px; border: 1px solid #ddd; border-radius: 20px; font-size: 15px; outline: none; }
        .topic-input:focus { border-color: #1185fe; }
        .generate-btn { padding: 10px 18px; background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%); color: white; border: none; border-radius: 20px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; min-width: 100px; }
        .generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .generate-btn:hover:not(:disabled) { opacity: 0.9; }
        .random-btn { padding: 10px 14px; background: #f3f3f8; border: 1px solid #e4e4e9; border-radius: 20px; font-size: 18px; cursor: pointer; transition: all 0.15s; }
        .random-btn:hover:not(:disabled) { background: #e8f4ff; border-color: #1185fe; transform: rotate(180deg); }
        .random-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .post { display: flex; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #e4e4e9; }
        .post:hover { background: #fafafa; }
        .post.user-post { background: #f0f7ff; border-left: 3px solid #1185fe; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .post-avatar { width: 44px; height: 44px; border-radius: 50%; background: #60a5fa; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 15px; }
        .post-body { flex: 1; min-width: 0; }
        .post-meta { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; flex-wrap: wrap; }
        .post-name { font-weight: 600; font-size: 15px; color: #111; }
        .post-handle { font-size: 14px; color: #666; }
        .post-dot { color: #666; }
        .post-time { font-size: 14px; color: #666; }
        .post-content { font-size: 15px; line-height: 1.5; color: #111; margin-bottom: 12px; white-space: pre-wrap; }
        .post-image-container { position: relative; margin-bottom: 12px; }
        .post-image { width: 100%; max-height: 300px; object-fit: cover; border-radius: 12px; background: #f0f0f5; display: block; }
        .photo-credit { position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; font-size: 11px; padding: 3px 8px; border-radius: 4px; }
        .post-actions { display: flex; gap: 2px; margin-left: -8px; }
        .action { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: none; border: none; border-radius: 20px; color: #666; font-size: 13px; cursor: pointer; }
        .action:hover { background: #f0f0f5; }
        .action svg { width: 18px; height: 18px; }
        .action.liked { color: #ec4899; }
        .action.reposted { color: #22c55e; }
        .action.has-comments { color: #1185fe; }
        .action.has-comments:hover { background: #e8f4ff; }
        .comments-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e4e4e9; display: flex; flex-direction: column; gap: 12px; }
        .comment { display: flex; gap: 10px; animation: fadeIn 0.25s ease; }
        .comment-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 12px; flex-shrink: 0; }
        .comment-body { flex: 1; min-width: 0; }
        .comment-meta { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 2px; }
        .comment-name { font-weight: 600; font-size: 14px; color: #111; }
        .comment-handle { font-size: 13px; color: #666; }
        .comment-time { font-size: 13px; color: #888; }
        .comment-content { font-size: 14px; line-height: 1.45; color: #222; }
        .comment-actions { display: flex; gap: 16px; margin-top: 6px; font-size: 12px; color: #666; }
        .comment-actions span { cursor: pointer; }
        .comment-actions span:hover { color: #1185fe; }
        .comment.user-comment { background: #f0f7ff; padding: 8px; margin: -8px; margin-bottom: 4px; border-radius: 8px; border-left: 2px solid #1185fe; }
        .reply-input-section { display: flex; gap: 8px; margin-top: 10px; }
        .reply-input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 16px; font-size: 13px; outline: none; }
        .reply-input:focus { border-color: #1185fe; }
        .reply-btn { padding: 8px 16px; background: #1185fe; color: white; border: none; border-radius: 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .reply-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .reply-btn:hover:not(:disabled) { background: #0969da; }
        .new-comment-section { display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e4e4e9; }
        .skeleton-post { pointer-events: none; }
        .skeleton { background: linear-gradient(90deg, #eee 25%, #ddd 50%, #eee 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; border-radius: 4px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .skeleton-avatar { width: 44px; height: 44px; border-radius: 50%; }
        .skeleton-name { width: 90px; height: 14px; display: inline-block; }
        .skeleton-handle { width: 120px; height: 14px; display: inline-block; margin-left: 8px; }
        .skeleton-content { width: 100%; height: 14px; margin: 10px 0 6px; }
        .skeleton-content-2 { width: 70%; height: 14px; margin-bottom: 14px; }
        .skeleton-action { width: 45px; height: 22px; border-radius: 11px; margin-right: 8px; }
        .load-more-section { padding: 20px; text-align: center; border-bottom: 1px solid #e4e4e9; }
        .load-more-btn { padding: 12px 28px; background: white; border: 1.5px solid #1185fe; color: #1185fe; border-radius: 20px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .load-more-btn:hover:not(:disabled) { background: #1185fe; color: white; }
        .load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .preload-status { font-size: 12px; color: #22c55e; margin-top: 8px; }
        .preload-status.loading { color: #666; }
        .error { margin: 16px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; font-size: 14px; }
        .empty-state { padding: 48px 24px; text-align: center; }
        .empty-icon { font-size: 48px; margin-bottom: 16px; }
        .empty-title { font-size: 18px; font-weight: 600; color: #333; margin-bottom: 8px; }
        .empty-text { font-size: 14px; color: #666; margin-bottom: 20px; }
        .suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
        .chip { padding: 8px 14px; background: #f3f3f8; border: 1px solid #e4e4e9; border-radius: 20px; font-size: 13px; color: #333; cursor: pointer; }
        .chip:hover { background: #e8f4ff; border-color: #1185fe; color: #1185fe; }
        .sidebar-right { width: 320px; padding: 10px 16px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
        .search-box { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #ebebf0; border-radius: 8px; margin-bottom: 16px; }
        .search-box svg { width: 18px; height: 18px; color: #666; flex-shrink: 0; }
        .search-box input { flex: 1; border: none; background: none; font-size: 14px; outline: none; }
        .sidebar-section { background: #f8f8fa; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
        .sidebar-title { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 12px; }
        .trending-item { display: flex; gap: 10px; padding: 8px 0; font-size: 14px; color: #333; cursor: pointer; }
        .trending-item:hover { color: #1185fe; }
        .trending-num { color: #888; width: 18px; }
        .footer { font-size: 12px; color: #888; padding: 16px 0; }
        .footer a { color: #888; text-decoration: none; margin-right: 12px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease; }
        .modal { background: white; border-radius: 16px; width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto; animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e4e4e9; }
        .modal-title { font-size: 18px; font-weight: 600; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; line-height: 1; }
        .modal-body { padding: 20px; }
        .modal-section { margin-bottom: 20px; }
        .modal-section:last-child { margin-bottom: 0; }
        .modal-section h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #333; }
        .modal-section p { font-size: 14px; color: #555; line-height: 1.6; }
        .modal-section ul { font-size: 14px; color: #555; line-height: 1.8; padding-left: 20px; }
        .new-post-textarea { width: 100%; min-height: 120px; padding: 14px; border: 1px solid #ddd; border-radius: 12px; font-size: 15px; font-family: inherit; resize: vertical; outline: none; }
        .new-post-textarea:focus { border-color: #1185fe; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
        .modal-btn { padding: 10px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .modal-btn.secondary { background: #f3f3f8; border: 1px solid #ddd; color: #333; }
        .modal-btn.primary { background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%); border: none; color: white; }
        .modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .slider-container { margin: 16px 0; }
        .slider-label { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px; color: #333; }
        .slider-value { font-weight: 600; color: #1185fe; background: #e8f4ff; padding: 4px 10px; border-radius: 12px; }
        .slider { width: 100%; height: 8px; border-radius: 4px; background: #e4e4e9; outline: none; -webkit-appearance: none; cursor: pointer; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%); cursor: pointer; box-shadow: 0 2px 6px rgba(17,133,254,0.3); }
        .slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, #1185fe 0%, #6366f1 100%); cursor: pointer; border: none; }
        .slider-labels { display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-top: 4px; }
        .education-preview { margin-top: 16px; padding: 12px; background: #f8f8fa; border-radius: 8px; font-size: 13px; color: #555; line-height: 1.5; }
        
        /* Tablet */
        @media (max-width: 1000px) { 
          .sidebar-right { display: none; } 
          .main-feed { max-width: 100%; }
        }
        
        /* Mobile */
        @media (max-width: 768px) { 
          html { font-size: 14px; }
          .layout { flex-direction: column; }
          .sidebar-left { 
            width: 100%; 
            height: auto; 
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            top: auto;
            flex-direction: row;
            background: white;
            border-top: 1px solid #e4e4e9;
            padding: 4px 8px;
            z-index: 100;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
          }
          .sidebar-left .logo { display: none; }
          .sidebar-left .nav { flex-direction: row; justify-content: space-around; width: 100%; gap: 0; }
          .sidebar-left .nav-item { padding: 8px 10px; flex-direction: column; gap: 2px; font-size: 10px; }
          .sidebar-left .nav-item svg { width: 22px; height: 22px; }
          .sidebar-left .nav-item span { display: block; }
          .sidebar-left .sidebar-spacer { display: none; }
          .sidebar-left .creator-link { display: none; }
          .sidebar-left .new-post-btn { 
            position: fixed;
            bottom: 70px;
            right: 12px;
            width: 50px;
            height: 50px;
            padding: 0;
            border-radius: 50%;
            box-shadow: 0 3px 10px rgba(17,133,254,0.3);
          }
          .sidebar-left .new-post-btn span { display: none; }
          .main-feed { 
            border: none; 
            padding-bottom: 70px;
            min-height: 100vh;
          }
          .feed-header { position: sticky; top: 0; }
          .feed-logo { padding: 10px; font-size: 15px; gap: 6px; }
          .feed-logo-icon { font-size: 20px; }
          .feed-tab { padding: 10px 6px; font-size: 12px; }
          .topic-input-section { padding: 8px 10px; gap: 8px; }
          .topic-avatar { width: 32px; height: 32px; font-size: 14px; }
          .topic-input-wrapper { flex: 1; gap: 6px; }
          .topic-input { padding: 8px 10px; font-size: 14px; border-radius: 16px; }
          .generate-btn { padding: 8px 12px; font-size: 13px; min-width: 70px; border-radius: 16px; }
          .random-btn { padding: 8px 10px; font-size: 16px; }
          .post { padding: 10px; gap: 10px; }
          .post-avatar { width: 36px; height: 36px; font-size: 13px; }
          .post-name { font-size: 14px; }
          .post-handle, .post-time { font-size: 12px; }
          .post-content { font-size: 14px; margin-bottom: 8px; }
          .post-image-container { margin-bottom: 8px; }
          .post-image { border-radius: 8px; max-height: 200px; }
          .photo-credit { font-size: 10px; padding: 2px 6px; }
          .post-actions { gap: 0; margin-left: -6px; }
          .action { padding: 6px 8px; font-size: 12px; }
          .action svg { width: 18px; height: 18px; }
          .comments-section { margin-top: 8px; padding-top: 8px; gap: 10px; }
          .comment { gap: 8px; }
          .comment-avatar { width: 26px; height: 26px; font-size: 10px; }
          .comment-name { font-size: 13px; }
          .comment-handle, .comment-time { font-size: 11px; }
          .comment-content { font-size: 13px; }
          .comment-actions { font-size: 11px; gap: 12px; margin-top: 4px; }
          .reply-input-section { gap: 6px; margin-top: 8px; }
          .reply-input { padding: 8px 10px; font-size: 14px; border-radius: 14px; }
          .reply-btn { padding: 8px 12px; font-size: 12px; border-radius: 14px; }
          .new-comment-section { gap: 6px; margin-top: 10px; padding-top: 10px; }
          .empty-state { padding: 24px 12px; }
          .empty-icon { font-size: 36px; margin-bottom: 12px; }
          .empty-title { font-size: 15px; }
          .empty-text { font-size: 13px; margin-bottom: 16px; }
          .chip { padding: 8px 12px; font-size: 12px; }
          .load-more-section { padding: 12px; }
          .load-more-btn { padding: 10px 20px; font-size: 13px; }
          .preload-status { font-size: 11px; }
          .modal { width: 94%; margin: 8px; border-radius: 12px; }
          .modal-header { padding: 12px 14px; }
          .modal-title { font-size: 15px; }
          .modal-body { padding: 14px; }
          .modal-section h3 { font-size: 14px; }
          .modal-section p, .modal-section ul { font-size: 13px; }
          .new-post-textarea { font-size: 14px; min-height: 80px; padding: 10px; }
          .modal-actions { flex-direction: column; gap: 8px; }
          .modal-btn { width: 100%; text-align: center; padding: 10px 16px; font-size: 13px; }
          .slider-container { margin: 12px 0; }
          .slider-label { font-size: 13px; }
          .slider-value { font-size: 12px; padding: 3px 8px; }
          .education-preview { font-size: 12px; padding: 10px; }
        }
        
        /* Small mobile */
        @media (max-width: 380px) {
          html { font-size: 13px; }
          .topic-input-section { flex-wrap: wrap; }
          .topic-avatar { display: none; }
          .topic-input-wrapper { width: 100%; }
          .feed-tab { font-size: 11px; padding: 8px 4px; }
          .sidebar-left .nav-item { padding: 6px 8px; }
          .sidebar-left .nav-item svg { width: 20px; height: 20px; }
          .sidebar-left .nav-item span { font-size: 9px; }
        }
      `}</style>

      <div className="layout">
        <aside className="sidebar-left">
          <div className="logo">
            <div className="logo-icon">🧠</div>
            <div className="logo-text">Intelligent Scroll<span>AI-Powered Feed</span></div>
          </div>
          <nav className="nav">
            <NavItem active icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} label="Home" />
            <NavItem icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>} label="Explore" onClick={exploreTopic} />
            <NavItem icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} label="How to Use" onClick={() => setShowHowTo(true)} />
            <NavItem icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>} label="Settings" onClick={() => setShowSettings(true)} />
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
            <div className="feed-logo"><span className="feed-logo-icon">🧠</span>Intelligent Scroll</div>
            <div className="feed-tabs">
              <div className={`feed-tab ${activeTab === 'discover' ? 'active' : ''}`} onClick={() => setActiveTab('discover')}>Discover</div>
              <div className={`feed-tab ${activeTab === 'following' ? 'active' : ''}`} onClick={() => setActiveTab('following')}>Following</div>
              <div className={`feed-tab ${activeTab === 'trending' ? 'active' : ''}`} onClick={() => setActiveTab('trending')}>Trending</div>
            </div>
          </header>
          <div className="topic-input-section">
            <div className="topic-avatar">🔍</div>
            <div className="topic-input-wrapper">
              <input ref={inputRef} type="text" className="topic-input" placeholder="Enter a topic to explore..." value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerate(topic)} disabled={isLoading} />
              <button className="generate-btn" onClick={() => handleGenerate(topic)} disabled={isLoading || !topic.trim()}>{isLoading ? 'Loading...' : 'Generate'}</button>
              <button className="random-btn" onClick={exploreTopic} disabled={isLoading} title="Random topic">🎲</button>
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="posts">
            {feed.map((post, i) => (<Post key={post.id || i} post={post} index={i} onAddReplies={handleAddReplies} isExpanded={expandedPosts.has(post.id)} onToggleExpand={toggleExpandPost} />))}
            {isLoading && [...Array(6)].map((_, i) => (<SkeletonPost key={`skeleton-${i}`} />))}
          </div>
          {feed.length > 0 && !isLoading && (
            <div className="load-more-section">
              <button className="load-more-btn" onClick={handleLoadMore} disabled={preloadedPosts.length === 0 && !isPreloading}>{preloadedPosts.length > 0 ? 'Load More' : 'Preparing...'}</button>
              {preloadedPosts.length > 0 && (<div className="preload-status">✓ {preloadedPosts.length} posts ready</div>)}
              {isPreloading && (<div className="preload-status loading">Loading next batch...</div>)}
            </div>
          )}
          {!isLoading && feed.length === 0 && !error && (
            <div className="empty-state">
              <div className="empty-icon">🧠</div>
              <h2 className="empty-title">Intelligent Scroll</h2>
              <p className="empty-text">Enter any topic to generate an AI-powered discussion feed, or create your own post!</p>
              <div className="suggestions">{['Black holes', 'Renaissance art', 'Jazz history', 'Climate solutions'].map(s => (<button key={s} className="chip" onClick={() => handleGenerate(s)}>{s}</button>))}</div>
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
            <div className="trending-list">{trending.map((item, i) => (<div key={i} className="trending-item" onClick={() => handleGenerate(item)}><span className="trending-num">{i + 1}.</span><span>{item}</span></div>))}</div>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-title">ℹ️ About</div>
            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6 }}>Intelligent Scroll generates educational social media discussions on any topic. Learn fascinating facts, explore different perspectives, and join conversations with AI-powered replies. Built with Groq's ultra-fast Llama models.</p>
          </div>
          <div className="footer"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">About</a></div>
        </aside>
      </div>

      {showHowTo && (
        <div className="modal-overlay" onClick={() => setShowHowTo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">📖 How to Use Intelligent Scroll</span><button className="modal-close" onClick={() => setShowHowTo(false)}>×</button></div>
            <div className="modal-body">
              <div className="modal-section"><h3>🔍 Explore Any Topic</h3><p>Type any topic in the search bar and click "Generate" to create an AI-powered feed of posts and discussions. Or click <strong>Explore</strong> in the sidebar to discover random interesting topics!</p></div>
              <div className="modal-section"><h3>✍️ Create Your Own Post</h3><p>Click "New Post" in the sidebar to write your own post. AI will generate thoughtful comments and replies. Your post appears naturally within the feed.</p></div>
              <div className="modal-section"><h3>💬 Reply to Comments</h3><p>Click "Reply" on any comment to join the conversation! Type your response and AI will generate follow-up replies, creating a dynamic back-and-forth discussion.</p></div>
              <div className="modal-section"><h3>⚙️ Customize Your Feed</h3><p>Click <strong>Settings</strong> to adjust how educational vs. casual you want the content. Slide from fun memes and hot takes (1) to deep educational content (10).</p></div>
              <div className="modal-section"><h3>⚡ Tips</h3><ul><li>Be specific with topics for better results</li><li>Use Explore to discover random interesting topics</li><li>Adjust education level in Settings to match your mood</li><li>Your posts and replies appear with a blue highlight</li></ul></div>
            </div>
          </div>
        </div>
      )}

      {showNewPost && (
        <div className="modal-overlay" onClick={() => !isPostingNew && setShowNewPost(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">✍️ Create a Post</span><button className="modal-close" onClick={() => !isPostingNew && setShowNewPost(false)}>×</button></div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>Write anything and AI will generate thoughtful comments and replies!</p>
              <textarea className="new-post-textarea" placeholder="What's on your mind? Share a thought, question, or hot take..." value={newPostContent} onChange={e => setNewPostContent(e.target.value)} disabled={isPostingNew} />
              <div className="modal-actions">
                <button className="modal-btn secondary" onClick={() => setShowNewPost(false)} disabled={isPostingNew}>Cancel</button>
                <button className="modal-btn primary" onClick={handleNewPost} disabled={!newPostContent.trim() || isPostingNew}>{isPostingNew ? 'Generating comments...' : 'Post & Generate Comments'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">⚙️ Settings</span><button className="modal-close" onClick={() => setShowSettings(false)}>×</button></div>
            <div className="modal-body">
              <div className="modal-section">
                <h3>📚 Content Style</h3>
                <p>Adjust how educational vs. casual you want the posts to be.</p>
                <div className="slider-container">
                  <div className="slider-label">
                    <span>Education Level</span>
                    <span className="slider-value">{educationLevel}/10</span>
                  </div>
                  <input type="range" className="slider" min="1" max="10" value={educationLevel} onChange={e => setEducationLevel(parseInt(e.target.value))} />
                  <div className="slider-labels">
                    <span>Casual & Fun</span>
                    <span>Highly Educational</span>
                  </div>
                </div>
                <div className="education-preview">
                  {educationLevel <= 3 && "🎉 Casual mode: Punchy takes, memes, relatable content with occasional facts sprinkled in."}
                  {educationLevel > 3 && educationLevel <= 6 && "⚖️ Balanced mode: Mix of interesting facts, personal perspectives, and accessible explanations."}
                  {educationLevel > 6 && "🎓 Educational mode: Deep dives, expert insights, specific facts and data. Learn something new!"}
                </div>
              </div>
              <div className="modal-section">
                <h3>💡 Tips</h3>
                <ul>
                  <li>Lower settings = more opinions, jokes, hot takes</li>
                  <li>Higher settings = more facts, research, expert analysis</li>
                  <li>Changes apply to new posts generated</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
