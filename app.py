from flask import Flask, render_template, request, redirect, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

app = Flask(__name__)
app.secret_key = 'secret123'


@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        connection = sqlite3.connect('database.db')
        cursor = connection.cursor()

        cursor.execute(
            'SELECT * FROM users WHERE username = ?',
            (username,)
        )
        user = cursor.fetchone()
        connection.close()

        if user and check_password_hash(user[2], password):
            session['user'] = username
            return redirect('/game')
        else:
            return "Неверный логин или пароль"

    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        hashed_password = generate_password_hash(password)

        connection = sqlite3.connect('database.db')
        cursor = connection.cursor()

        try:
            cursor.execute(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                (username, hashed_password)
            )
            connection.commit()
            connection.close()
            return redirect('/')
        except sqlite3.IntegrityError:
            connection.close()
            return "Пользователь уже существует"

    return render_template('register.html')


@app.route('/game')
def game():
    if 'user' not in session:
        return redirect('/')

    username = session['user']

    connection = sqlite3.connect('database.db')
    cursor = connection.cursor()

    cursor.execute(
        'SELECT best_score FROM users WHERE username = ?',
        (username,)
    )
    result = cursor.fetchone()

    best_score = result[0] if result else 0

    cursor.execute(
        'SELECT username, best_score FROM users ORDER BY best_score DESC LIMIT 5'
    )
    leaders = cursor.fetchall()

    connection.close()

    return render_template(
        'game.html',
        username=username,
        best_score=best_score,
        leaders=leaders
    )


@app.route('/save_score', methods=['POST'])
def save_score():
    if 'user' not in session:
        return jsonify({'status': 'error', 'message': 'Пользователь не авторизован'})

    data = request.get_json()
    score = data.get('score', 0)
    username = session['user']

    connection = sqlite3.connect('database.db')
    cursor = connection.cursor()

    cursor.execute(
        'SELECT best_score FROM users WHERE username = ?',
        (username,)
    )
    result = cursor.fetchone()

    current_best = result[0] if result else 0

    if score > current_best:
        cursor.execute(
            'UPDATE users SET best_score = ? WHERE username = ?',
            (score, username)
        )
        connection.commit()

    connection.close()

    return jsonify({'status': 'success'})


@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect('/')


if __name__ == '__main__':
    app.run(debug=True)