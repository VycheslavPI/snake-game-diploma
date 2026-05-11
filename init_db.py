import sqlite3

connection = sqlite3.connect('database.db')
cursor = connection.cursor()

cursor.execute('''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    best_score INTEGER DEFAULT 0
)
''')

try:
    cursor.execute('ALTER TABLE users ADD COLUMN best_score INTEGER DEFAULT 0')
except sqlite3.OperationalError:
    pass

connection.commit()
connection.close()

print("База данных обновлена!")