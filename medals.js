const medalsCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTWiatOyiL0qN6cWPjyyLvUAPwx3H3RJUvd05bloi4GLtRE8wSrg7fA91wchZWjm1GLCrBaJ5USsaDL/pub?gid=46175271&single=true&output=csv";

async function loadMedals() {
    const response = await fetch(medalsCsvUrl);
    const data = await response.text();

    const rows = data.trim().split("\n").slice(1);
    const tbody = document.getElementById("medals");

    tbody.innerHTML = "";

    rows.forEach(row => {
        const cols = row.split(",");

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${cols[0] || ""}</td>
            <td>${cols[1] || ""}</td>
            <td>${cols[2] || ""}</td>
            <td>${cols[3] || ""}</td>
            <td>${cols[4] || ""}</td>
        `;

        tbody.appendChild(tr);
    });
}

loadMedals();