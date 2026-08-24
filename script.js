document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    // V1 visual prototype: region switching is ready for the database API.
    // In the next step these lists will be populated from PostgreSQL.
  });
});
