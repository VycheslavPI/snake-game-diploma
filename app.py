from flask import Flask, render_template, request, redirect, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
import psycopg2.extras
import os
import sqlite3

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")

DATABASE_URL = os.environ.get("DATABASE_URL")
DATABASE_PATH = os.environ.get("DATABASE_PATH", "database.db")
USE_SQLITE = not DATABASE_URL


class SQLiteCursor:
    def __init__(self, cursor, connection):
        self.cursor = cursor
        self.connection = connection

    def execute(self, query, params=None):
        query = query.replace("%s", "?")
        query = query.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")
        return self.cursor.execute(query, params or ())

    def fetchone(self):
        row = self.cursor.fetchone()
        return dict(row) if row else None

    def fetchall(self):
        return [dict(row) for row in self.cursor.fetchall()]

    def close(self):
        self.cursor.close()


class SQLiteConnection:
    def __init__(self, path):
        self.connection = sqlite3.connect(path)
        self.connection.row_factory = sqlite3.Row

    def cursor(self):
        return SQLiteCursor(self.connection.cursor(), self)

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def close(self):
        self.connection.close()


SKINS = {
    "neon": {
        "name": "Neon",
        "price": 0,
        "head": "#b7ff00",
        "body1": "#00ff99",
        "body2": "#00cc66"
    },
    "fire": {
        "name": "Fire",
        "price": 50,
        "head": "#ffff66",
        "body1": "#ff9900",
        "body2": "#ff0000"
    },
    "ice": {
        "name": "Ice",
        "price": 75,
        "head": "#e0f2fe",
        "body1": "#38bdf8",
        "body2": "#0284c7"
    },
    "purple": {
        "name": "Void",
        "price": 100,
        "head": "#e879f9",
        "body1": "#a855f7",
        "body2": "#6d28d9"
    }
}


TRAILS = {
    "none": {
        "name": "No Trail",
        "price": 0,
        "color1": "rgba(0,0,0,0)",
        "color2": "rgba(0,0,0,0)",
        "description": "Без следа"
    },
    "neon": {
        "name": "Neon Trail",
        "price": 60,
        "color1": "#00ffcc",
        "color2": "#00ccff",
        "description": "Кибер-неоновый след"
    },
    "fire": {
        "name": "Fire Trail",
        "price": 90,
        "color1": "#ff9900",
        "color2": "#ff0033",
        "description": "Огненные частицы"
    },
    "ice": {
        "name": "Ice Trail",
        "price": 110,
        "color1": "#bae6fd",
        "color2": "#38bdf8",
        "description": "Ледяной светящийся след"
    },
    "void": {
        "name": "Void Trail",
        "price": 140,
        "color1": "#c084fc",
        "color2": "#7c3aed",
        "description": "Фиолетовый туманный след"
    },
    "rainbow": {
        "name": "Rainbow Trail",
        "price": 200,
        "color1": "#ff00cc",
        "color2": "#00ffff",
        "description": "Редкий радужный эффект"
    }
}


ACHIEVEMENTS = {
    "first_game": {
        "title": "Первый запуск",
        "description": "Сыграть первую игру",
        "reward": 10
    },
    "score_25": {
        "title": "Новичок",
        "description": "Набрать 25 очков",
        "reward": 25
    },
    "score_100": {
        "title": "Опытный игрок",
        "description": "Набрать 100 очков",
        "reward": 50
    },
    "score_250": {
        "title": "Мастер змейки",
        "description": "Набрать 250 очков",
        "reward": 100
    },
    "level_5": {
        "title": "Покоритель уровней",
        "description": "Дойти до 5 уровня",
        "reward": 75
    },
    "level_10": {
        "title": "Финалист",
        "description": "Дойти до 10 уровня",
        "reward": 200
    },
    "coins_200": {
        "title": "Коллекционер",
        "description": "Накопить 200 монет",
        "reward": 50
    }
}


def get_db_connection():
    if USE_SQLITE:
        return SQLiteConnection(DATABASE_PATH)

    return psycopg2.connect(
        DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor
    )


def add_column_if_missing(cursor, connection, column_name, column_type):
    try:
        cursor.execute(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}")
        connection.commit()
    except (psycopg2.errors.DuplicateColumn, sqlite3.OperationalError):
        connection.rollback()


def init_database():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            score INTEGER DEFAULT 0,
            best_score INTEGER DEFAULT 0,
            coins INTEGER DEFAULT 0,
            selected_skin TEXT DEFAULT 'neon',
            owned_skins TEXT DEFAULT 'neon',
            selected_trail TEXT DEFAULT 'none',
            owned_trails TEXT DEFAULT 'none',
            games_played INTEGER DEFAULT 0,
            best_level INTEGER DEFAULT 1
        )
    """)

    connection.commit()

    extra_columns = {
        "score": "INTEGER DEFAULT 0",
        "best_score": "INTEGER DEFAULT 0",
        "coins": "INTEGER DEFAULT 0",
        "selected_skin": "TEXT DEFAULT 'neon'",
        "owned_skins": "TEXT DEFAULT 'neon'",
        "selected_trail": "TEXT DEFAULT 'none'",
        "owned_trails": "TEXT DEFAULT 'none'",
        "games_played": "INTEGER DEFAULT 0",
        "best_level": "INTEGER DEFAULT 1"
    }

    for column_name, column_type in extra_columns.items():
        add_column_if_missing(cursor, connection, column_name, column_type)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_achievements (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, achievement_id)
        )
    """)

    connection.commit()
    cursor.close()
    connection.close()


init_database()


def unlock_achievement(cursor, username, achievement_id):
    try:
        cursor.execute("""
            INSERT INTO user_achievements (username, achievement_id)
            VALUES (%s, %s)
        """, (username, achievement_id))

        reward = ACHIEVEMENTS[achievement_id]["reward"]

        cursor.execute("""
            UPDATE users
            SET coins = coins + %s
            WHERE username = %s
        """, (reward, username))

        return True

    except (psycopg2.errors.UniqueViolation, sqlite3.IntegrityError):
        cursor.connection.rollback()
        return False


def check_achievements(cursor, username, score, level):
    unlocked = []

    cursor.execute("""
        SELECT coins, games_played, best_score, best_level
        FROM users
        WHERE username = %s
    """, (username,))

    user = cursor.fetchone()

    if not user:
        return unlocked

    checks = []

    if user["games_played"] >= 1:
        checks.append("first_game")

    if score >= 25 or user["best_score"] >= 25:
        checks.append("score_25")

    if score >= 100 or user["best_score"] >= 100:
        checks.append("score_100")

    if score >= 250 or user["best_score"] >= 250:
        checks.append("score_250")

    if level >= 5 or user["best_level"] >= 5:
        checks.append("level_5")

    if level >= 10 or user["best_level"] >= 10:
        checks.append("level_10")

    if user["coins"] >= 200:
        checks.append("coins_200")

    for achievement_id in checks:
        was_unlocked = unlock_achievement(cursor, username, achievement_id)

        if was_unlocked:
            unlocked.append({
                "id": achievement_id,
                "title": ACHIEVEMENTS[achievement_id]["title"],
                "reward": ACHIEVEMENTS[achievement_id]["reward"]
            })

    return unlocked


@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT * FROM users WHERE username = %s",
            (username,)
        )

        user = cursor.fetchone()

        cursor.close()
        connection.close()

        if user and check_password_hash(user["password"], password):
            session["user"] = username
            return redirect("/game")

        return "Неверный логин или пароль"

    return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        hashed_password = generate_password_hash(password)

        connection = get_db_connection()
        cursor = connection.cursor()

        try:
            cursor.execute("""
                INSERT INTO users
                (
                    username,
                    password,
                    score,
                    best_score,
                    coins,
                    selected_skin,
                    owned_skins,
                    selected_trail,
                    owned_trails,
                    games_played,
                    best_level
                )
                VALUES (%s, %s, 0, 0, 0, 'neon', 'neon', 'none', 'none', 0, 1)
            """, (username, hashed_password))

            connection.commit()

            cursor.close()
            connection.close()

            return redirect("/")

        except (psycopg2.errors.UniqueViolation, sqlite3.IntegrityError):
            connection.rollback()
            cursor.close()
            connection.close()
            return "Пользователь уже существует"

    return render_template("register.html")


@app.route("/game")
def game():
    if "user" not in session:
        return redirect("/")

    username = session["user"]

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT best_score, coins, selected_skin, selected_trail
        FROM users
        WHERE username = %s
        """,
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        session.pop("user", None)
        return redirect("/")

    cursor.execute("""
        SELECT username, best_score
        FROM users
        ORDER BY best_score DESC, id DESC
        LIMIT 10
    """)

    leaders = cursor.fetchall()

    cursor.close()
    connection.close()

    skin_data = SKINS.get(user["selected_skin"], SKINS["neon"])
    trail_data = TRAILS.get(user["selected_trail"], TRAILS["none"])

    return render_template(
        "game.html",
        username=username,
        best_score=user["best_score"],
        coins=user["coins"],
        leaders=leaders,
        skin_data=skin_data,
        trail_data=trail_data
    )


@app.route("/save_score", methods=["POST"])
def save_score():
    if "user" not in session:
        return jsonify({"status": "error"})

    data = request.get_json()

    score = int(data.get("score", 0))
    level = int(data.get("level", 1))

    username = session["user"]

    earned_coins = score // 5

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT best_score, coins, games_played, best_level FROM users WHERE username = %s",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        return jsonify({"status": "error"})

    new_best = max(user["best_score"], score)
    new_best_level = max(user["best_level"], level)
    new_coins = user["coins"] + earned_coins
    new_games_played = user["games_played"] + 1

    cursor.execute("""
        UPDATE users
        SET best_score = %s,
            coins = %s,
            games_played = %s,
            best_level = %s
        WHERE username = %s
    """, (new_best, new_coins, new_games_played, new_best_level, username))

    unlocked = check_achievements(cursor, username, score, level)

    connection.commit()

    cursor.close()
    connection.close()

    return jsonify({
        "status": "success",
        "earned_coins": earned_coins,
        "total_coins": new_coins,
        "best_score": new_best,
        "best_level": new_best_level,
        "is_new_best": score > user["best_score"],
        "unlocked": unlocked
    })


@app.route("/shop")
def shop():
    if "user" not in session:
        return redirect("/")

    username = session["user"]

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT coins, selected_skin, owned_skins, selected_trail, owned_trails
        FROM users
        WHERE username = %s
        """,
        (username,)
    )

    user = cursor.fetchone()

    cursor.close()
    connection.close()

    if not user:
        return redirect("/")

    owned_skins = user["owned_skins"].split(",")
    owned_trails = user["owned_trails"].split(",")

    return render_template(
        "shop.html",
        username=username,
        coins=user["coins"],
        skins=SKINS,
        trails=TRAILS,
        selected_skin=user["selected_skin"],
        owned_skins=owned_skins,
        selected_trail=user["selected_trail"],
        owned_trails=owned_trails
    )


@app.route("/achievements")
def achievements():
    if "user" not in session:
        return redirect("/")

    username = session["user"]

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT achievement_id
        FROM user_achievements
        WHERE username = %s
    """, (username,))

    unlocked_rows = cursor.fetchall()
    unlocked_ids = [row["achievement_id"] for row in unlocked_rows]

    cursor.execute("""
        SELECT best_score, best_level, games_played, coins
        FROM users
        WHERE username = %s
    """, (username,))

    user_stats = cursor.fetchone()

    cursor.close()
    connection.close()

    achievements_list = []

    for achievement_id, achievement in ACHIEVEMENTS.items():
        achievements_list.append({
            "id": achievement_id,
            "title": achievement["title"],
            "description": achievement["description"],
            "reward": achievement["reward"],
            "unlocked": achievement_id in unlocked_ids
        })

    return render_template(
        "achievements.html",
        username=username,
        achievements=achievements_list,
        stats=user_stats
    )


@app.route("/buy_skin/<skin_id>", methods=["POST"])
def buy_skin(skin_id):
    if "user" not in session:
        return redirect("/")

    if skin_id not in SKINS:
        return redirect("/shop")

    username = session["user"]

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT coins, owned_skins FROM users WHERE username = %s",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        return redirect("/shop")

    coins = user["coins"]
    owned_skins = user["owned_skins"].split(",")

    if skin_id in owned_skins:
        cursor.close()
        connection.close()
        return redirect("/shop")

    price = SKINS[skin_id]["price"]

    if coins >= price:
        coins -= price
        owned_skins.append(skin_id)

        cursor.execute("""
            UPDATE users
            SET coins = %s, owned_skins = %s
            WHERE username = %s
        """, (coins, ",".join(owned_skins), username))

        connection.commit()

    cursor.close()
    connection.close()

    return redirect("/shop")


@app.route("/select_skin/<skin_id>", methods=["POST"])
def select_skin(skin_id):
    if "user" not in session:
        return redirect("/")

    if skin_id not in SKINS:
        return redirect("/shop")

    username = session["user"]

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT owned_skins FROM users WHERE username = %s",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        return redirect("/shop")

    owned_skins = user["owned_skins"].split(",")

    if skin_id in owned_skins:
        cursor.execute(
            "UPDATE users SET selected_skin = %s WHERE username = %s",
            (skin_id, username)
        )
        connection.commit()

    cursor.close()
    connection.close()

    return redirect("/shop")


@app.route("/buy_trail/<trail_id>", methods=["POST"])
def buy_trail(trail_id):
    if "user" not in session:
        return redirect("/")

    if trail_id not in TRAILS:
        return redirect("/shop")

    username = session["user"]

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT coins, owned_trails FROM users WHERE username = %s",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        return redirect("/shop")

    coins = user["coins"]
    owned_trails = user["owned_trails"].split(",")

    if trail_id in owned_trails:
        cursor.close()
        connection.close()
        return redirect("/shop")

    price = TRAILS[trail_id]["price"]

    if coins >= price:
        coins -= price
        owned_trails.append(trail_id)

        cursor.execute("""
            UPDATE users
            SET coins = %s, owned_trails = %s
            WHERE username = %s
        """, (coins, ",".join(owned_trails), username))

        connection.commit()

    cursor.close()
    connection.close()

    return redirect("/shop")


@app.route("/select_trail/<trail_id>", methods=["POST"])
def select_trail(trail_id):
    if "user" not in session:
        return redirect("/")

    if trail_id not in TRAILS:
        return redirect("/shop")

    username = session["user"]

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT owned_trails FROM users WHERE username = %s",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        return redirect("/shop")

    owned_trails = user["owned_trails"].split(",")

    if trail_id in owned_trails:
        cursor.execute(
            "UPDATE users SET selected_trail = %s WHERE username = %s",
            (trail_id, username)
        )
        connection.commit()

    cursor.close()
    connection.close()

    return redirect("/shop")


@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect("/")


if __name__ == "__main__":
    app.run(debug=True)
