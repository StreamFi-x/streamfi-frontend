document.addEventListener("DOMContentLoaded", () => {
    const links: NodeListOf<HTMLAnchorElement> = document.querySelectorAll(".footer-link, .footer-link1");

    links.forEach((link) =>{
        link.addEventListener("click", (event) =>{
            event.preventDefault();
            window.location.href = "/";
        } )
    })
})