from flask import Flask, render_template, request, redirect, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
import psycopg2.extras
import os

app = Flask(__name__)
app.secret_key = "secret123"

DATABASE_URL = os.environ.get("DATABASE_URL")


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


def get_db_connection():
    return psycopg2.connect(
        DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor
    )


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
            owned_trails TEXT DEFAULT 'none'
        )
    """)

    extra_columns = {
        "score": "INTEGER DEFAULT 0",
        "best_score": "INTEGER DEFAULT 0",
        "coins": "INTEGER DEFAULT 0",
        "selected_skin": "TEXT DEFAULT 'neon'",
        "owned_skins": "TEXT DEFAULT 'neon'",
        "selected_trail": "TEXT DEFAULT 'none'",
        "owned_trails": "TEXT DEFAULT 'none'"
    }

    for column_name, column_type in extra_columns.items():
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}")
            connection.commit()
        except psycopg2.errors.DuplicateColumn:
            connection.rollback()

    connection.commit()
    cursor.close()
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
                (username, password, score, best_score, coins, selected_skin, owned_skins, selected_trail, owned_trails)
                VALUES (%s, %s, 0, 0, 0, 'neon', 'neon', 'none', 'none')
            """, (username, hashed_password))

            connection.commit()

            cursor.close()
            connection.close()

            return redirect("/")

        except psycopg2.errors.UniqueViolation:
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
    username = session["user"]

    earned_coins = score // 5

    connection = get_db_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT best_score, coins FROM users WHERE username = %s",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        return jsonify({"status": "error"})

    new_best = max(user["best_score"], score)
    new_coins = user["coins"] + earned_coins

    cursor.execute("""
        UPDATE users
        SET best_score = %s, coins = %s
        WHERE username = %s
    """, (new_best, new_coins, username))

    connection.commit()

    cursor.close()
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
        "SELECT coins, owned_skins FROM users WHERE username = %s",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        return redirect("/")

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
        "SELECT owned_skins FROM users WHERE username = %s",
        (username,)
    )

    user = cursor.fetchone()

    if not user:
        cursor.close()
        connection.close()
        return redirect("/")

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


@app.route("/buy_trail/<trail_id>")
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


@app.route("/select_trail/<trail_id>")
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