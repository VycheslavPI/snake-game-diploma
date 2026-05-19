import os

from app import app


if __name__ == "__main__":
    os.environ.setdefault("DATABASE_PATH", "database.db")
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)
