import sqlite3

connection = sqlite3.connect('database.db')
cursor = connection.cursor()

cursor.execute('UPDATE users SET best_score = 0')

connection.commit()
connection.close()

print("Рекорды сброшены!")