// auth-server.mjs
import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const CLIENT_ID = 'Ov23liWNwWqM9SO0J9nF';
const CLIENT_SECRET = 'b8450c9c5d239237b169cc062dc5080d52393bcb'; // Замените на реальный ключ
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/auth', async (req, res) => {
  try {
    const { code } = req.body;
    
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: 'application/json' }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Auth server running on port ${PORT}`);
});