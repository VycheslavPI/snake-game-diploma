import sqlite3

connection = sqlite3.connect("database.db")
cursor = connection.cursor()

cursor.execute(
    "UPDATE users SET coins = 50 WHERE username = 'test5'"
)

connection.commit()
connection.close()

print("Монеты выданы!")