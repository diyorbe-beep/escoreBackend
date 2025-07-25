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

// Helper: read/write JSON
function readData(file) {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
function writeData(file, data) {
  const filePath = path.join(dataDir, file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- Superadmin va adminni har doim mavjud qilish ---
async function ensureSuperadminAndAdminSupabase() {
  // Check users in Supabase
  const { data: users, error } = await supabase.from('users').select('*');
  if (error) throw new Error('Supabase users fetch error: ' + error.message);
  let superadminExists = users.some(u => u.email === SUPERADMIN.email);
  let adminExists = users.some(u => u.email === ADMIN.email);
  if (!superadminExists) {
    await supabase.from('users').insert([{ ...SUPERADMIN }]);
  }
  if (!adminExists) {
    await supabase.from('users').insert([{ ...ADMIN }]);
  }
}

ensureSuperadminAndAdminSupabase();

// --- MongoDB va Mongoose bilan bog'liq kodlar olib tashlandi ---
// --- News endpoints (Supabase) ---
app.get('/api/news', async (req, res) => {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .eq('deleted', false)
    .order('published_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/news', async (req, res) => {
  const { title, content, image, status, isFeatured, category } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title va content majburiy' });
  // isFeatured bo'lsa, avval hammasini false qilamiz
  if (isFeatured) {
    await supabase.from('news').update({ is_featured: false }).neq('id', null);
  }
  const { data, error } = await supabase.from('news').insert([{
    id: uuidv4(),
    title,
    content,
    image: image || null,
    status: status || 'Draft',
    is_featured: !!isFeatured,
    category: category || '',
    deleted: false,
    published_at: new Date().toISOString(),
  }]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data[0]);
});

app.put('/api/news/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, image, status, isFeatured, category } = req.body;
    if (isFeatured) {
      await supabase.from('news').update({ is_featured: false }).neq('id', id);
    }
    const { data, error } = await supabase.from('news').update({
      title,
      content,
      image,
      status,
      is_featured: !!isFeatured,
      category: category || '',
    }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, news: data && data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/news/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('news').update({ deleted: true }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- News Comments API ---
app.get('/api/news/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { data: comments, error } = await supabase.from('comments').select('*').eq('newsId', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(comments);
});

app.post('/api/news/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { author, text } = req.body;
  if (!author || !text) return res.status(400).json({ error: 'Ism va izoh majburiy' });
  const newComment = {
    id: uuidv4(),
    newsId: id,
    author,
    text,
    createdAt: new Date().toISOString()
  };
  const { error } = await supabase.from('comments').insert([newComment]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(newComment);
});

app.delete('/api/news/:id/comments/:commentId', async (req, res) => {
  const { id, commentId } = req.params;
  // Check if comment exists
  const { data: comments, error: fetchError } = await supabase.from('comments').select('*').eq('id', commentId).eq('newsId', id);
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!comments || comments.length === 0) return res.status(404).json({ error: 'Izoh topilmadi' });
  const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('newsId', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- Admin endpoints (faqat superadmin qo'sha oladi) ---
app.get('/api/admins', async (req, res) => {
  const { data: admins, error } = await supabase.from('admins').select('*');
  if (error) return res.status(500).json({ error: error.message });
  // Superadmin har doim birinchi bo'lib qaytadi
  if (!admins.find(a => a.email === SUPERADMIN.email)) {
    admins.unshift({ id: SUPERADMIN.id, name: SUPERADMIN.name, email: SUPERADMIN.email, role: SUPERADMIN.role });
  }
  res.json(admins);
});

app.post('/api/admins', async (req, res) => {
  const { name, email, role = 'admin', superadminToken } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Ism va email majburiy' });
  if (email === SUPERADMIN.email) return res.status(400).json({ error: 'Superadminni qo\'shib bo\'lmaydi' });
  if (role !== 'admin' && role !== 'journalist') return res.status(400).json({ error: 'Faqat admin yoki jurnalist qo\'shish mumkin' });
  if (superadminToken !== SUPERADMIN.password) return res.status(403).json({ error: 'Faqat superadmin admin yoki jurnalist qo\'sha oladi' });
  // Check if admin exists in Supabase
  const { data: admins, error: fetchError } = await supabase.from('admins').select('*').eq('email', email);
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (admins.length > 0) return res.status(400).json({ error: 'Bu email admin sifatida mavjud' });
  const newAdmin = { id: uuidv4(), name, email, role };
  const { error: insertError } = await supabase.from('admins').insert([newAdmin]);
  if (insertError) return res.status(500).json({ error: insertError.message });
  // users jadvaliga ham qo'shamiz
  const { error: userInsertError } = await supabase.from('users').insert([{ id: newAdmin.id, name, email, password: 'admin123', role }]);
  if (userInsertError) return res.status(500).json({ error: userInsertError.message });
  res.status(201).json(newAdmin);
});

app.delete('/api/admins/:id', async (req, res) => {
  const { id } = req.params;
  // Superadminni o'chirishga yo'l qo'ymaymiz
  if (id === SUPERADMIN.id) return res.status(400).json({ error: 'Superadminni o\'chirish mumkin emas' });
  // Delete from admins
  const { error } = await supabase.from('admins').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
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

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: users, error } = await supabase.from('users').select('*').eq('email', email).eq('password', password);
  if (error) return res.status(500).json({ error: error.message });
  if (!users || users.length === 0) return res.status(401).json({ error: 'Email yoki parol xato' });
  // Demo token
  const token = uuidv4();
  res.json({ token, user: users[0] });
});

// --- Matches (Supabase) ---
app.get('/api/matches', async (req, res) => {
  const { data: matches, error } = await supabase.from('matches').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(matches);
});

// --- Polls (Supabase) ---
app.get('/api/polls', async (req, res) => {
  const { data: polls, error } = await supabase.from('polls').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(polls);
});

// Yangi poll qo'shish (faqat admin/superadmin)
app.post('/api/polls', async (req, res) => {
  const { question, options, role } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'Savol va kamida 2 ta variant majburiy' });
  }
  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({ error: "Faqat admin yoki superadmin so'rovnoma qo'sha oladi" });
  }
  const votes = {};
  options.forEach(opt => { votes[opt] = 0; });
  const newPoll = {
    id: uuidv4(),
    question,
    options,
    votes,
    createdAt: new Date().toISOString()
  };
  const { error } = await supabase.from('polls').insert([newPoll]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(newPoll);
});

app.post('/api/polls/vote', async (req, res) => {
  const { pollId, option } = req.body;
  const { data: polls, error: fetchError } = await supabase.from('polls').select('*').eq('id', pollId);
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!polls || polls.length === 0) return res.status(404).json({ error: 'Poll topilmadi' });
  const poll = polls[0];
  poll.votes[option] = (poll.votes[option] || 0) + 1;
  const { error } = await supabase.from('polls').update({ votes: poll.votes }).eq('id', pollId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/polls/:id', async (req, res) => {
  const { id } = req.params;
  const { role, superadminToken } = req.query;
  if (role !== 'admin' && role !== 'superadmin' && superadminToken !== SUPERADMIN.password) {
    return res.status(403).json({ error: "Faqat admin yoki superadmin so'rovnomani o'chira oladi" });
  }
  const { error } = await supabase.from('polls').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
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

// Rasm yuklash endpointi (Cloudinary)
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file || !req.file.path) return res.status(400).json({ error: 'Fayl topilmadi' });
  res.json({ url: req.file.path });
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