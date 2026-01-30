// Netlify serverless function to proxy Groq API calls and fetch images
// This keeps your API keys secure on the server

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt, type, query } = JSON.parse(event.body);
    
    // Handle image search requests
    if (type === 'image') {
      const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
      
      if (!PEXELS_API_KEY) {
        // Return a fallback placeholder if no API key
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ 
            images: [] 
          }),
        };
      }
      
      const searchQuery = encodeURIComponent(query || 'nature');
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${searchQuery}&per_page=5&orientation=landscape`,
        {
          headers: { 'Authorization': PEXELS_API_KEY }
        }
      );
      
      if (!response.ok) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ images: [] }),
        };
      }
      
      const data = await response.json();
      const images = (data.photos || []).map(photo => ({
        url: photo.src.large,
        alt: photo.alt || `Image related to ${query}`,
        photographer: photo.photographer,
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ images }),
      };
    }

    // Handle text generation requests
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'GROQ_API_KEY not configured' }) 
      };
    }
    
    let systemPrompt = '';
    let userPrompt = prompt;
    
    if (type === 'feed') {
      systemPrompt = `You are a social media content generator. Generate realistic social media posts in JSON format only. No markdown, no explanation, just valid JSON array.`;
    } else if (type === 'comments') {
      systemPrompt = `You are a social media comment generator. Generate realistic, thoughtful comments/replies in JSON format only. No markdown, no explanation, just valid JSON array.`;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { 
        statusCode: response.status, 
        body: JSON.stringify({ error: `Groq API error: ${error}` }) 
      };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '[]';
    
    // Clean and parse JSON
    let cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // Try to extract JSON array if wrapped in text
    const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: cleanContent,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
