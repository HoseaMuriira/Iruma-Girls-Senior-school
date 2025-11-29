const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const FILE = path.join(__dirname, '..', 'database.sqlite');

let db = null;

async function getDb(){
  if (db) return db;
  db = await open({ filename: FILE, driver: sqlite3.Database });
  return db;
}

async function ensureDb(){
  const database = await getDb();
  // Create tables
  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'student',
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT,
      email TEXT,
      kcpe TEXT,
      notes TEXT,
      created_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      message TEXT,
      created_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      admission_no TEXT,
      pathway TEXT,
      year INTEGER
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      subject TEXT,
      score INTEGER,
      term TEXT,
      year INTEGER
    );
  `);

  // seed departments if empty
  const c = await database.get('SELECT COUNT(1) as cnt FROM departments');
  if (!c || c.cnt === 0) {
    await database.run('INSERT INTO departments (name,description) VALUES (?,?)', 'Science (STEM)', 'Physics, Chemistry, Biology, Mathematics, Computer Studies');
    await database.run('INSERT INTO departments (name,description) VALUES (?,?)', 'Humanities', 'Languages, History, Geography, Social Studies');
    await database.run('INSERT INTO departments (name,description) VALUES (?,?)', 'Arts & Sports', 'Music, Visual Arts, Drama, Athletics');
  }

  return database;
}

module.exports = { ensureDb, getDb };
