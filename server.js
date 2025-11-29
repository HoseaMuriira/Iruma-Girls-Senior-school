const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { ensureDb, getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: path.resolve(__dirname, '..') }),
  secret: process.env.SESSION_SECRET || 'a-secure-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 2 }
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, '..')));

function requireAuth(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (role && req.session.user.role !== role && req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const db = await getDb();
    const { fullname, email, password, role } = req.body;
    if (!fullname || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (existing) return res.status(409).json({ error: 'User exists' });
    const hash = await bcrypt.hash(password, 10);
    const stmt = await db.run('INSERT INTO users (fullname,email,password,role) VALUES (?,?,?,?)', fullname, email, hash, role);
    const user = await db.get('SELECT id,fullname,email,role FROM users WHERE id = ?', stmt.lastID);
    req.session.user = user;
    const accepts = req.headers.accept || '';
    if (accepts.includes('text/html')) return res.redirect('/dashboard-student.html');
    res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const db = await getDb();
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    const user = await db.get('SELECT id,fullname,email,password,role FROM users WHERE email = ?', email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    delete user.password;
    req.session.user = user;
    const accepts = req.headers.accept || '';
    if (accepts.includes('text/html')){
      if (user.role === 'student') return res.redirect('/dashboard-student.html');
      if (user.role === 'teacher') return res.redirect('/dashboard-staff.html');
      return res.redirect('/index.html');
    }
    res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    const accepts = req.headers.accept || '';
    if (accepts.includes('text/html')) return res.redirect('/index.html');
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ ok: true, user: req.session.user });
});

// profile: returns combined user profile and student record if exists
app.get('/api/profile', requireAuth(), async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.get('SELECT id,fullname,email,role,created_at FROM users WHERE id = ?', req.session.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const student = await db.get('SELECT id,admission_no,pathway,year FROM students WHERE user_id = ?', user.id);
    res.json({ ok: true, profile: { user, student } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/apply', async (req, res) => {
  try {
    const db = await getDb();
    const { fullName, email, kcpe, notes } = req.body;
    await db.run('INSERT INTO applications (fullname,email,kcpe,notes,created_at) VALUES (?,?,?,?,datetime("now"))', fullName, email, kcpe, notes);
    res.redirect('/admissions.html?applied=1');
  } catch (err) { console.error(err); res.status(500).send('Error'); }
});

app.post('/contact-send', async (req, res) => {
  try {
    const db = await getDb();
    const { name, email, message } = req.body;
    await db.run('INSERT INTO contacts (name,email,message,created_at) VALUES (?,?,?,datetime("now"))', name, email, message);
    res.redirect('/contact.html?sent=1');
  } catch (err) { console.error(err); res.status(500).send('Error'); }
});

app.get('/api/departments', async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT id,name,description FROM departments ORDER BY id');
    res.json({ ok: true, departments: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/students', requireAuth('teacher'), async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT s.id, s.admission_no, s.pathway, s.year, u.fullname, u.email FROM students s JOIN users u ON u.id = s.user_id');
    res.json({ ok: true, students: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/students/:id/results', requireAuth(), async (req, res) => {
  try {
    const db = await getDb();
    const studentId = Number(req.params.id);
    if (req.session.user.role === 'student') {
      const row = await db.get('SELECT id FROM students WHERE id = ? AND user_id = ?', studentId, req.session.user.id);
      if (!row) return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await db.all('SELECT id, subject, score, term, year FROM results WHERE student_id = ?', studentId);
    res.json({ ok: true, results: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

(async () => {
  await ensureDb();
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
})();
