(function () {
    const storageKey = "neonSnakeTheme";
    const root = document.documentElement;
    const buttons = document.querySelectorAll("[data-theme-toggle]");

    function applyTheme(theme) {
        root.classList.toggle("theme-light", theme === "light");
        root.classList.toggle("theme-dark", theme !== "light");

        buttons.forEach(button => {
            button.innerText = theme === "light" ? "Тёмная тема" : "Светлая тема";
        });
    }

    const savedTheme = localStorage.getItem(storageKey) || "dark";
    applyTheme(savedTheme);

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const nextTheme = root.classList.contains("theme-light") ? "dark" : "light";
            localStorage.setItem(storageKey, nextTheme);
            applyTheme(nextTheme);
        });
    });
})();
