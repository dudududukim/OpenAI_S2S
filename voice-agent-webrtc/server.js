import 'dotenv/config';
import http from 'node:http';

const PORT = process.env.PORT || 8787;

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/session') {
    try {
      const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2025-06-03'
        })
      });
      const json = await r.json();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ apiKey: json.client_secret?.value }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'failed_to_create_ephemeral' }));
    }
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => console.log(`session server on :${PORT}`));
