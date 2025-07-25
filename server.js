const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
// Cloudinary
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const FormData = require('form-data');

const SUPABASE_URL = 'https://rizfpyurlqwuydltxflk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpemZweXVybHF3dXlkbHR4ZmxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0MTk1ODQsImV4cCI6MjA2ODk5NTU4NH0.KfJ56Zc1PRvZx0-DuPmvzFC7fLQOIgAAZPjqnNscqc0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'escore-news',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 800, height: 600, crop: 'limit' }],
  },
});
const upload = multer({ storage });

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Data folder
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Ensure matches.json exists
const matchesFile = path.join(dataDir, 'matches.json');
if (!fs.existsSync(matchesFile)) {
  fs.writeFileSync(matchesFile, JSON.stringify([], null, 2));
}

// Superadmin va admin ma'lumotlari
const SUPERADMIN = {
  id: 'superadmin-1',
  name: 'Asosiy Admin',
  email: 'superadmin@mail.com',
  password: 'admin123',
  role: 'superadmin'
};
const ADMIN = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@mail.com',
  password: 'admin123',
  role: 'admin'
};

// Helper functions for JSON file CRUD
function readJson(file) {
  const filePath = path.join(__dirname, 'data', file);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
function writeJson(file, data) {
  const filePath = path.join(__dirname, 'data', file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- NEWS ---
app.get('/api/news', (req, res) => {
  const news = readJson('news.json').filter(n => !n.deleted);
  res.json(news);
});
app.get('/api/news/:id', (req, res) => {
  const news = readJson('news.json');
  const item = news.find(n => n.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Yangilik topilmadi' });
  res.json(item);
});
app.post('/api/news', (req, res) => {
  const { title, content, image, status, category, isFeatured } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title va content majburiy' });
  let news = readJson('news.json');
  const newItem = {
    id: uuidv4(),
    title,
    content,
    image: image || '',
    status: status || 'Draft',
    category: category || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
    isFeatured: !!isFeatured
  };
  news.push(newItem);
  writeJson('news.json', news);
  res.status(201).json(newItem);
});
app.put('/api/news/:id', (req, res) => {
  const { id } = req.params;
  let news = readJson('news.json');
  const idx = news.findIndex(n => n.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Yangilik topilmadi' });
  news[idx] = { ...news[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJson('news.json', news);
  res.json(news[idx]);
});
app.delete('/api/news/:id', (req, res) => {
  const { id } = req.params;
  let news = readJson('news.json');
  const idx = news.findIndex(n => n.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Yangilik topilmadi' });
  news[idx].deleted = true;
  writeJson('news.json', news);
  res.json({ success: true });
});

// --- MATCHES ---
app.get('/api/matches', (req, res) => {
  const matches = readJson('matches.json');
  res.json(matches);
});
app.get('/api/matches/:id', (req, res) => {
  const matches = readJson('matches.json');
  const item = matches.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Match topilmadi' });
  res.json(item);
});
app.post('/api/matches', (req, res) => {
  const { home, away, time, date, league } = req.body;
  if (!home || !away || !time || !date || !league) return res.status(400).json({ error: 'Barcha maydonlar majburiy' });
  let matches = readJson('matches.json');
  const newItem = {
    id: uuidv4(),
    home,
    away,
    time,
    date,
    league,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  matches.push(newItem);
  writeJson('matches.json', matches);
  res.status(201).json(newItem);
});
app.put('/api/matches/:id', (req, res) => {
  const { id } = req.params;
  let matches = readJson('matches.json');
  const idx = matches.findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Match topilmadi' });
  matches[idx] = { ...matches[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJson('matches.json', matches);
  res.json(matches[idx]);
});
app.delete('/api/matches/:id', (req, res) => {
  const { id } = req.params;
  let matches = readJson('matches.json');
  const idx = matches.findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Match topilmadi' });
  matches.splice(idx, 1);
  writeJson('matches.json', matches);
  res.json({ success: true });
});

// --- POLLS ---
app.get('/api/polls', (req, res) => {
  const polls = readJson('polls.json');
  res.json(polls);
});
app.get('/api/polls/:id', (req, res) => {
  const polls = readJson('polls.json');
  const item = polls.find(p => p.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Poll topilmadi' });
  res.json(item);
});
app.post('/api/polls', (req, res) => {
  const { question, options } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'Savol va kamida 2 ta variant majburiy' });
  }
  let polls = readJson('polls.json');
  const votes = {};
  options.forEach(opt => { votes[opt] = 0; });
  const newItem = {
    id: uuidv4(),
    question,
    options,
    votes,
    createdAt: new Date().toISOString()
  };
  polls.push(newItem);
  writeJson('polls.json', polls);
  res.status(201).json(newItem);
});
app.put('/api/polls/:id', (req, res) => {
  const { id } = req.params;
  let polls = readJson('polls.json');
  const idx = polls.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Poll topilmadi' });
  polls[idx] = { ...polls[idx], ...req.body };
  writeJson('polls.json', polls);
  res.json(polls[idx]);
});
app.delete('/api/polls/:id', (req, res) => {
  const { id } = req.params;
  let polls = readJson('polls.json');
  const idx = polls.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Poll topilmadi' });
  polls.splice(idx, 1);
  writeJson('polls.json', polls);
  res.json({ success: true });
});
app.post('/api/polls/vote', (req, res) => {
  const { pollId, option } = req.body;
  let polls = readJson('polls.json');
  const idx = polls.findIndex(p => p.id === pollId);
  if (idx === -1) return res.status(404).json({ error: 'Poll topilmadi' });
  if (!polls[idx].votes[option]) polls[idx].votes[option] = 0;
  polls[idx].votes[option] += 1;
  writeJson('polls.json', polls);
  res.json({ success: true });
});

// --- CATEGORIES ---
app.get('/api/categories', (req, res) => {
  const categories = readJson('categories.json');
  res.json(categories);
});
app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Kategoriya nomi majburiy' });
  let categories = readJson('categories.json');
  const newItem = { id: uuidv4(), name };
  categories.push(newItem);
  writeJson('categories.json', categories);
  res.status(201).json(newItem);
});
app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  let categories = readJson('categories.json');
  const idx = categories.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Kategoriya topilmadi' });
  categories.splice(idx, 1);
  writeJson('categories.json', categories);
  res.json({ success: true });
});

// --- COMMENTS ---
app.get('/api/comments', (req, res) => {
  const comments = readJson('comments.json');
  res.json(comments);
});
app.get('/api/news/:id/comments', (req, res) => {
  const { id } = req.params;
  const comments = readJson('comments.json').filter(c => c.newsId === id);
  res.json(comments);
});
app.post('/api/news/:id/comments', (req, res) => {
  const { id } = req.params;
  const { author, text } = req.body;
  if (!author || !text) return res.status(400).json({ error: 'Ism va izoh majburiy' });
  let comments = readJson('comments.json');
  const newItem = {
    id: uuidv4(),
    newsId: id,
    author,
    text,
    createdAt: new Date().toISOString()
  };
  comments.push(newItem);
  writeJson('comments.json', comments);
  res.status(201).json(newItem);
});
app.delete('/api/comments/:id', (req, res) => {
  const { id } = req.params;
  let comments = readJson('comments.json');
  const idx = comments.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Izoh topilmadi' });
  comments.splice(idx, 1);
  writeJson('comments.json', comments);
  res.json({ success: true });
});

// --- User Auth (faqat user roli register bo'ladi) ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Barcha maydonlar majburiy' });
  if (email === SUPERADMIN.email || email === ADMIN.email) return res.status(400).json({ error: 'Bu email band' });
  const { data: users, error: fetchError } = await supabase.from('users').select('*').eq('email', email);
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (users.length > 0) return res.status(400).json({ error: 'Email band' });
  const { data, error } = await supabase.from('users').insert([{ id: uuidv4(), name, email, password, role: 'user' }]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: "Ro'yxatdan o'tildi", user: data[0] });
});

// Foydalanuvchini JSON file orqali login qilish
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const fs = require('fs');
  const usersPath = path.join(__dirname, 'data', 'users.json');
  if (!fs.existsSync(usersPath)) {
    return res.status(500).json({ error: 'Foydalanuvchilar fayli topilmadi' });
  }
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Email yoki parol xato' });
  }
  const token = 'demo-token';
  res.json({ token, user });
});

// --- User profile (oddiy demo) ---
app.get('/api/user/:id', async (req, res) => {
  const { id } = req.params;
  const { data: users, error } = await supabase.from('users').select('*').eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  if (!users || users.length === 0) return res.status(404).json({ error: 'User topilmadi' });
  res.json(users[0]);
});

// --- Category endpoints (Supabase, faqat superadmin kategoriya qo'sha oladi) ---
app.get('/api/categories', async (req, res) => {
  const { data: categories, error } = await supabase.from('categories').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(categories);
});

app.post('/api/categories', async (req, res) => {
  const { name, superadminToken } = req.body;
  if (!name) return res.status(400).json({ error: 'Kategoriya nomi majburiy' });
  if (superadminToken !== SUPERADMIN.password) return res.status(403).json({ error: 'Faqat superadmin kategoriya qo\'sha oladi' });
  // Check if category exists
  const { data: categories, error: fetchError } = await supabase.from('categories').select('*').eq('name', name);
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (categories.length > 0) return res.status(400).json({ error: 'Bu nomli kategoriya allaqachon mavjud' });
  const newCategory = { id: uuidv4(), name };
  const { error } = await supabase.from('categories').insert([newCategory]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(newCategory);
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { superadminToken } = req.query;
  if (superadminToken !== SUPERADMIN.password) return res.status(403).json({ error: 'Faqat superadmin kategoriya o\'chira oladi' });
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Static uploads
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Uploadcare orqali fayl yuklash
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Fayl topilmadi' });
  }
  const fs = require('fs');
  const form = new FormData();
  form.append('UPLOADCARE_PUB_KEY', UPLOADCARE_PUBLIC_KEY);
  form.append('UPLOADCARE_STORE', '1');
  form.append('file', fs.createReadStream(req.file.path));
  try {
    const response = await axios.post(
      'https://upload.uploadcare.com/base/',
      form,
      { headers: form.getHeaders() }
    );
    fs.unlinkSync(req.file.path); // vaqtincha faylni o'chirish
    const fileId = response.data.file;
    const fileUrl = `https://ucarecdn.com/${fileId}/`;
    res.json({ url: fileUrl });
  } catch (error) {
    res.status(500).json({ error: 'Uploadcare xatosi: ' + error.message });
  }
});

const teamLogos = {
  'Real Madrid': 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
  'Barcelona': 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
  'Manchester United': 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
  'Liverpool': 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
  'Bayern Munich': 'https://upload.wikimedia.org/wikipedia/en/1/1f/FC_Bayern_München_logo_%282017%29.svg',
  'Juventus': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Juventus_FC_2017_logo.svg',
  'Chelsea': 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
  'Arsenal': 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
  'PSG': 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
  'Inter': 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
  'Milan': 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg',
  'Atletico Madrid': 'https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg',
  'Dortmund': 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg',
  'Tottenham': 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg',
  'Roma': 'https://upload.wikimedia.org/wikipedia/en/f/f7/AS_Roma_logo_%282017%29.svg',
  'Napoli': 'https://upload.wikimedia.org/wikipedia/commons/2/2d/SSC_Napoli.svg',
  'Ajax': 'https://upload.wikimedia.org/wikipedia/en/7/79/Ajax_Amsterdam.svg',
  'Porto': 'https://upload.wikimedia.org/wikipedia/en/3/3f/FC_Porto.svg',
  'Benfica': 'https://upload.wikimedia.org/wikipedia/en/8/89/SL_Benfica_logo.svg',
  'Sevilla': 'https://upload.wikimedia.org/wikipedia/en/3/3c/Sevilla_FC_logo.svg',
  'Leipzig': 'https://upload.wikimedia.org/wikipedia/en/0/04/RB_Leipzig_2014_logo.svg',
  'Leicester City': 'https://upload.wikimedia.org/wikipedia/en/2/2d/Leicester_City_crest.svg',
  'Shakhtar Donetsk': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/FC_Shakhtar_Donetsk.svg',
  'Galatasaray': 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Galatasaray_Sports_Club_Logo.png',
  'Fenerbahce': 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Fenerbahçe_SK.svg',
  'Besiktas': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Besiktas_JK.svg',
  // ... boshqa mashhur klublar qo'shish mumkin ...
};

app.get('/api/featured-match', async (req, res) => {
  const { data: matches, error } = await supabase.from('matches').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(matches);
});

app.post('/api/featured-match', async (req, res) => {
  const { home, away, time, date, league } = req.body;
  if (!home || !away || !time || !date || !league) return res.status(400).json({ error: 'Barcha maydonlar majburiy' });
  if (home === away) return res.status(400).json({ error: 'Uy va mehmon jamoalari bir xil bo\'lishi mumkin emas' });
  const newMatch = {
    id: uuidv4(),
    home: { name: home, logo: teamLogos[home] || null },
    away: { name: away, logo: teamLogos[away] || null },
    time,
    date,
    league,
    createdAt: new Date().toISOString()
  };
  const { error } = await supabase.from('matches').insert([newMatch]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(newMatch);
});

app.put('/api/featured-match/:id', async (req, res) => {
  const { id } = req.params;
  const { home, away, time, date, league } = req.body;
  if (!home || !away || !time || !date || !league) return res.status(400).json({ error: 'Barcha maydonlar majburiy' });
  if (home === away) return res.status(400).json({ error: 'Uy va mehmon jamoalari bir xil bo\'lishi mumkin emas' });
  const { data: matches, error: fetchError } = await supabase.from('matches').select('*').eq('id', id);
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!matches || matches.length === 0) return res.status(404).json({ error: 'Match topilmadi' });
  const updatedMatch = {
    home: { name: home, logo: teamLogos[home] || null },
    away: { name: away, logo: teamLogos[away] || null },
    time,
    date,
    league,
    updatedAt: new Date().toISOString()
  };
  const { error } = await supabase.from('matches').update(updatedMatch).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/featured-match/:id', async (req, res) => {
  const { id } = req.params;
  const { data: matches, error: fetchError } = await supabase.from('matches').select('*').eq('id', id);
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!matches || matches.length === 0) return res.status(404).json({ error: 'Match topilmadi' });
  const { error } = await supabase.from('matches').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`eScore backend running on http://localhost:${PORT}`);
}); 