document.addEventListener("DOMContentLoaded", function () {
    var links = document.querySelectorAll(".footer-link, .footer-link1");
    links.forEach(function (link) {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            window.location.href = "/";
        });
    });
});
