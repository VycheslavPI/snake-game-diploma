from flask import Flask, render_template, request, redirect, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os

app = Flask(__name__)
app.secret_key = "secret123"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "database.db")


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


def get_db_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_database():
    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute("""
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
    """)

    columns = {
        "score": "INTEGER DEFAULT 0",
        "best_score": "INTEGER DEFAULT 0",
        "coins": "INTEGER DEFAULT 0",
        "selected_skin": "TEXT DEFAULT 'neon'",
        "owned_skins": "TEXT DEFAULT 'neon'"
    }

    for column, column_type in columns.items():
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {column} {column_type}")
        except sqlite3.OperationalError:
            pass

    connection.commit()
    connection.close()


init_database()


@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT * FROM users WHERE username = ?",
            (username,)
        )

        user = cursor.fetchone()
        connection.close()

        if user:
            saved_password = user["password"]

            if check_password_hash(saved_password, password) or saved_password == password:
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
                (username, password, score, best_score, coins, selected_skin, owned_skins)
                VALUES (?, ?, 0, 0, 0, 'neon', 'neon')
            """, (username, hashed_password))

            connection.commit()
            connection.close()

            return redirect("/")

        except sqlite3.IntegrityError:
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
        "SELECT best_score, coins, selected_skin FROM users WHERE username = ?",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        connection.close()
        session.pop("user", None)
        return redirect("/")

    best_score = user["best_score"]
    coins = user["coins"]
    selected_skin = user["selected_skin"]

    cursor.execute("""
        SELECT username, best_score
        FROM users
        ORDER BY best_score DESC, id DESC
        LIMIT 10
    """)

    leaders = cursor.fetchall()
    connection.close()

    skin_data = SKINS.get(selected_skin, SKINS["neon"])

    return render_template(
        "game.html",
        username=username,
        best_score=best_score,
        coins=coins,
        leaders=leaders,
        skin_data=skin_data
    )


@app.route("/save_score", methods=["POST"])
def save_score():
    if "user" not in session:
        return jsonify({"status": "error"})

    data = request.get_json()
    score = int(data.get("score", 0))
    username = session["user"]

    earned_coins = score // 5

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT best_score, coins FROM users WHERE username = ?",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        connection.close()
        return jsonify({"status": "error"})

    current_best = user["best_score"]
    current_coins = user["coins"]

    new_best = max(current_best, score)
    new_coins = current_coins + earned_coins

    cursor.execute("""
        UPDATE users
        SET best_score = ?, coins = ?
        WHERE username = ?
    """, (new_best, new_coins, username))

    connection.commit()
    connection.close()

    return jsonify({
        "status": "success",
        "earned_coins": earned_coins
    })


@app.route("/shop")
def shop():
    if "user" not in session:
        return redirect("/")

    username = session["user"]

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT coins, selected_skin, owned_skins FROM users WHERE username = ?",
        (username,)
    )

    user = cursor.fetchone()
    connection.close()

    if not user:
        return redirect("/")

    coins = user["coins"]
    selected_skin = user["selected_skin"]
    owned_skins = user["owned_skins"].split(",")

    return render_template(
        "shop.html",
        username=username,
        coins=coins,
        skins=SKINS,
        selected_skin=selected_skin,
        owned_skins=owned_skins
    )


@app.route("/buy_skin/<skin_id>")
def buy_skin(skin_id):
    if "user" not in session:
        return redirect("/")

    if skin_id not in SKINS:
        return redirect("/shop")

    username = session["user"]

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT coins, owned_skins FROM users WHERE username = ?",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        connection.close()
        return redirect("/")

    coins = user["coins"]
    owned_skins = user["owned_skins"].split(",")

    if skin_id in owned_skins:
        connection.close()
        return redirect("/shop")

    price = SKINS[skin_id]["price"]

    if coins >= price:
        coins -= price
        owned_skins.append(skin_id)

        cursor.execute("""
            UPDATE users
            SET coins = ?, owned_skins = ?
            WHERE username = ?
        """, (coins, ",".join(owned_skins), username))

        connection.commit()

    connection.close()
    return redirect("/shop")


@app.route("/select_skin/<skin_id>")
def select_skin(skin_id):
    if "user" not in session:
        return redirect("/")

    if skin_id not in SKINS:
        return redirect("/shop")

    username = session["user"]

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT owned_skins FROM users WHERE username = ?",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        connection.close()
        return redirect("/")

    owned_skins = user["owned_skins"].split(",")

    if skin_id in owned_skins:
        cursor.execute(
            "UPDATE users SET selected_skin = ? WHERE username = ?",
            (skin_id, username)
        )
        connection.commit()

    connection.close()
    return redirect("/shop")


@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect("/")


if __name__ == "__main__":
    app.run(debug=True)