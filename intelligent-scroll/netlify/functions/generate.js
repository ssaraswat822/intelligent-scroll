// Netlify serverless function to proxy Groq API calls
// This keeps your API key secure on the server

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  
  if (!GROQ_API_KEY) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'GROQ_API_KEY not configured' }) 
    };
  }

  try {
    const { prompt, type } = JSON.parse(event.body);
    
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
        model: 'llama-3.3-70b-versatile', // Fast and capable
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
