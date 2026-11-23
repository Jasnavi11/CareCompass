document.getElementById("loginForm")
.addEventListener("submit", function(e) {

    e.preventDefault();

    const email =
    document.getElementById("email").value;

    const password =
    document.getElementById("password").value;

    if (email && password.length >= 6) {
        window.location.href = "index.html";
    } else {
        document.getElementById("message")
        .textContent = "Enter a valid password!";
    }
});