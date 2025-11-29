const bcrypt = require('bcrypt');
const { ensureDb, getDb } = require('./db');

(async function seed(){
  await ensureDb();
  const db = await getDb();

  // create example users if missing
  const exists = await db.get('SELECT id FROM users WHERE email = ?', 'admin@iruma.test');
  if (!exists) {
    const adminPw = await bcrypt.hash('Admin123!', 10);
    const teacherPw = await bcrypt.hash('Teacher123!',10);
    const studentPw = await bcrypt.hash('Student123!',10);
    await db.run('INSERT INTO users (fullname,email,password,role) VALUES (?,?,?,?)', 'Principal - Iruma', 'admin@iruma.test', adminPw, 'admin');
    await db.run('INSERT INTO users (fullname,email,password,role) VALUES (?,?,?,?)', 'Miss Njoki', 'teacher@iruma.test', teacherPw, 'teacher');
    await db.run('INSERT INTO users (fullname,email,password,role) VALUES (?,?,?,?)', 'Jane Student', 'student@iruma.test', studentPw, 'student');

    // simple students table
    const studentUser = await db.get('SELECT id FROM users WHERE email = ?', 'student@iruma.test');
    const studentId = studentUser ? studentUser.id : null;
    if (studentId) {
      await db.run('INSERT INTO students (user_id,admission_no,pathway,year) VALUES (?,?,?,?)', studentId, 'IR/2025/01', 'STEM', 2025);
      const stu = await db.get('SELECT id FROM students WHERE user_id = ?', studentId);
      if (stu) {
        await db.run('INSERT INTO results (student_id,subject,score,term,year) VALUES (?,?,?,?,?)', stu.id, 'Mathematics', 84, 'Term 1', 2025);
        await db.run('INSERT INTO results (student_id,subject,score,term,year) VALUES (?,?,?,?,?)', stu.id, 'Biology', 78, 'Term 1', 2025);
        await db.run('INSERT INTO results (student_id,subject,score,term,year) VALUES (?,?,?,?,?)', stu.id, 'English', 88, 'Term 1', 2025);
      }
    }

    console.log('Seeded users, a sample student and results.');
  } else {
    console.log('Seed already exists — skipping.');
  }
  process.exit(0);
})();
