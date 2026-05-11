const resultsCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTWiatOyiL0qN6cWPjyyLvUAPwx3H3RJUvd05bloi4GLtRE8wSrg7fA91wchZWjm1GLCrBaJ5USsaDL/pub?gid=1974038512&single=true&output=csv";

async function loadResults() {
    const response = await fetch(resultsCsvUrl);
    const data = await response.text();

    const rows = data.trim().split("\n").slice(1);
    const tbody = document.getElementById("results");

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

loadResults();