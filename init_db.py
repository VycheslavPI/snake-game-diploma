import sqlite3

connection = sqlite3.connect('database.db')
cursor = connection.cursor()

cursor.execute('''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    best_score INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 0,
    selected_skin TEXT DEFAULT 'neon',
    owned_skins TEXT DEFAULT 'neon'
)
''')

columns_to_add = [
    ("best_score", "INTEGER DEFAULT 0"),
    ("coins", "INTEGER DEFAULT 0"),
    ("selected_skin", "TEXT DEFAULT 'neon'"),
    ("owned_skins", "TEXT DEFAULT 'neon'")
]

for column_name, column_type in columns_to_add:
    try:
        cursor.execute(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}")
    except sqlite3.OperationalError:
        pass

connection.commit()
connection.close()

print("База данных обновлена!")