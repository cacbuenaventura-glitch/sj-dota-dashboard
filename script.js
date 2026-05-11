const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTWiatOyiL0qN6cWPjyyLvUAPwx3H3RJUvd05bloi4GLtRE8wSrg7fA91wchZWjm1GLCrBaJ5USsaDL/pub?gid=380076190&single=true&output=csv";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxB4zau23c2v_s5JtKGKr8sCqmiuc4fYo80SS6MJUPA85aQg0l4paw-kctxUOxfKQ9H/exec";

let players = [];
let selectedCaptains = [];
let shuffledCaptains = [];
let draftedPlayers = [];
let draftPickIndex = 0;
let draftComplete = false;

function showSection(sectionId) {
    document.querySelectorAll(".section").forEach(section => {
        section.classList.remove("active");
    });

    document.getElementById(sectionId).classList.add("active");
}

async function loadRoster() {
    const response = await fetch(SHEET_URL + "&cache=" + Date.now());
    const text = await response.text();

    const rows = text.trim().split("\n").slice(1);

    players = rows.map((row, index) => {
        const cols = row.split(",");

        return {
            rowNumber: index + 2,
            attendance: (cols[0] || "").trim().toUpperCase() === "TRUE",
            name: (cols[1] || "").trim(),
            role: (cols[2] || "").trim(),
            rank: (cols[3] || "").trim(),
            dotaId: (cols[4] || "").trim(),
            discord: (cols[5] || "").trim(),
            team: (cols[6] || "").trim(),
            status: (cols[7] || "").trim()
        };
    }).filter(player => player.name !== "");

    renderRoster();
    renderPools();
    renderCaptains();
    renderDraftTeams();
    renderPickHistory();
}

function renderRoster() {
    const roster = document.getElementById("roster");
    roster.innerHTML = "";

    players.forEach(player => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                <input type="checkbox"
                    ${player.attendance ? "checked" : ""}
                    onchange="updateAttendance(${player.rowNumber}, this.checked)">
            </td>
            <td>${player.name}</td>
            <td>${player.role}</td>
            <td>${player.rank}</td>
            <td>${player.dotaId}</td>
            <td>${player.discord}</td>
            <td>${player.team}</td>
            <td>${player.status}</td>
        `;

        roster.appendChild(tr);
    });
}

function renderPools() {
    const ids = [
        "carry-pool",
        "midlane-pool",
        "offlane-pool",
        "support-pool",
        "hard-support-pool",
        "all-roles-pool"
    ];

    ids.forEach(id => {
        document.getElementById(id).innerHTML = "";
    });

    players
        .filter(player => player.attendance)
        .filter(player => !selectedCaptains.some(captain => captain.name === player.name))
        .filter(player => !draftedPlayers.some(drafted => drafted.name === player.name))
        .forEach(player => {
            const item = document.createElement("div");

            item.className = "player-item";
            item.draggable = true;

            item.dataset.name = player.name;
            item.dataset.rank = player.rank;
            item.dataset.role = player.role;

            item.ondragstart = dragPlayer;

            item.onclick = function () {
                if (shuffledCaptains.length > 0 && !draftComplete) {
                    draftPlayer(player);
                }
            };

            item.innerHTML = `
                <span>${player.name}</span>
                <span>${player.rank}</span>
            `;

            const role = player.role.toLowerCase();

            if (role.includes("carry") || role.includes("safelane")) {
                document.getElementById("carry-pool").appendChild(item);
            } else if (role.includes("mid")) {
                document.getElementById("midlane-pool").appendChild(item);
            } else if (role.includes("offlane")) {
                document.getElementById("offlane-pool").appendChild(item);
            } else if (role.includes("hard support") || role.includes("hardsupport")) {
                document.getElementById("hard-support-pool").appendChild(item);
            } else if (role.includes("support")) {
                document.getElementById("support-pool").appendChild(item);
            } else {
                document.getElementById("all-roles-pool").appendChild(item);
            }
        });
}

function dragPlayer(event) {
    const data = {
        name: event.target.dataset.name,
        rank: event.target.dataset.rank,
        role: event.target.dataset.role
    };

    event.dataTransfer.setData("application/json", JSON.stringify(data));
}

function allowDrop(event) {
    event.preventDefault();
}

function dropCaptain(event) {
    event.preventDefault();

    if (shuffledCaptains.length > 0) return;

    const player = JSON.parse(event.dataTransfer.getData("application/json"));

    const exists = selectedCaptains.some(captain => captain.name === player.name);

    if (exists) return;

    selectedCaptains.push(player);

    shuffledCaptains = [];
    draftedPlayers = [];
    draftPickIndex = 0;
    draftComplete = false;

    renderCaptains();
    renderPools();
    renderDraftTeams();
    renderPickHistory();
}

function renderCaptains() {
    const captainList = document.getElementById("captain-list");
    const draftMessage = document.getElementById("draft-message");

    captainList.innerHTML = "";

    if (selectedCaptains.length === 0) {
        draftMessage.innerHTML = "Drag captains here first.";
    } else if (shuffledCaptains.length === 0) {
        draftMessage.innerHTML = `${selectedCaptains.length} captain(s) selected.`;
    }

    selectedCaptains.forEach((captain, index) => {
        const chip = document.createElement("div");
        chip.className = "captain-chip";

        chip.innerHTML = `
            <span>${captain.name}</span>
            <span>${captain.rank}</span>
            <button class="remove-btn" onclick="removeCaptain(${index})">X</button>
        `;

        captainList.appendChild(chip);
    });
}

function removeCaptain(index) {
    if (shuffledCaptains.length > 0) return;

    selectedCaptains.splice(index, 1);

    shuffledCaptains = [];
    draftedPlayers = [];
    draftPickIndex = 0;
    draftComplete = false;

    renderCaptains();
    renderPools();
    renderDraftTeams();
    renderPickHistory();
}

function shuffleCaptains() {
    if (selectedCaptains.length === 0) return;

    shuffledCaptains = [...selectedCaptains].sort(() => Math.random() - 0.5);

    draftedPlayers = [];
    draftPickIndex = 0;
    draftComplete = false;

    document.body.classList.add("drafting-started");

    renderDraftStatus();
    renderPools();
    renderDraftTeams();
    renderPickHistory();
}

function getTeamIndex(pickIndex, teamCount) {
    const draftMode = document.getElementById("draft-mode").value;

    const round = Math.floor(pickIndex / teamCount);
    const position = pickIndex % teamCount;

    if (draftMode === "alternating") {
        return position;
    }

    return round % 2 === 0
        ? position
        : teamCount - 1 - position;
}

function getTeamSize(teamIndex) {
    const captainCount = shuffledCaptains[teamIndex] ? 1 : 0;

    const memberCount = draftedPlayers.filter(player =>
        player.teamIndex === teamIndex
    ).length;

    return captainCount + memberCount;
}

function getRemainingPlayers() {
    return players
        .filter(player => player.attendance)
        .filter(player => !selectedCaptains.some(captain => captain.name === player.name))
        .filter(player => !draftedPlayers.some(drafted => drafted.name === player.name));
}

function getNextValidTeamIndex() {
    const teamCount = shuffledCaptains.length;
    let safety = 0;

    while (safety < teamCount * 10) {
        const teamIndex = getTeamIndex(draftPickIndex, teamCount);

        if (getTeamSize(teamIndex) < 5) {
            return teamIndex;
        }

        draftPickIndex++;
        safety++;
    }

    return null;
}

function draftPlayer(player) {
    if (shuffledCaptains.length === 0) return;
    if (draftComplete) return;

    const teamIndex = getNextValidTeamIndex();

    if (teamIndex === null) {
        renderDraftStatus();
        return;
    }

    draftedPlayers.push({
        ...player,
        teamIndex: teamIndex,
        draftOrder: draftedPlayers.length + 1
    });

    draftPickIndex++;

    renderDraftStatus();
    renderPools();
    renderDraftTeams();
    renderPickHistory();
    saveTeamsToSheet();
}

function randomizeLastPlayers() {
    if (draftComplete) return;
    if (shuffledCaptains.length === 0) return;

    const remaining = getRemainingPlayers();

    if (remaining.length === 0) return;

    const shuffledRemaining = [...remaining]
        .sort(() => Math.random() - 0.5);

    shuffledRemaining.forEach(player => {

        const availableTeams = shuffledCaptains
            .map((captain, index) => index)
            .filter(index => getTeamSize(index) < 5);

        if (availableTeams.length === 0) {
            return;
        }

        const randomTeam =
            availableTeams[
                Math.floor(Math.random() * availableTeams.length)
            ];

        draftedPlayers.push({
            ...player,
            teamIndex: randomTeam,
            draftOrder: draftedPlayers.length + 1
        });
    });

    draftComplete = true;

    renderDraftStatus();
    renderPools();
    renderDraftTeams();
    renderPickHistory();
    saveTeamsToSheet();

    document.getElementById("draft-message").innerHTML =
        "Draft complete. Remaining players randomly assigned.";
}

function renderDraftStatus() {
    const draftMessage = document.getElementById("draft-message");

    if (shuffledCaptains.length === 0) return;

    if (draftComplete) {
        draftMessage.innerHTML = "Draft complete.";
        return;
    }

    const teamIndex = getNextValidTeamIndex();

    if (teamIndex === null) {
        draftMessage.innerHTML = "Draft complete.";
        return;
    }

    const captain = shuffledCaptains[teamIndex];

    draftMessage.innerHTML = `
        NOW PICKING:
        <br>
        <span class="current-pick-team">${captain.name} Team</span>
    `;
}

function getRoleIcon(role) {
    const r = role.toLowerCase();

    if (r.includes("any role") || r.includes("all roles")) {
        return `
            <span class="multi-role-icons">
                <img src="icons/safelane.png" class="team-role-icon">
                <img src="icons/midlane.png" class="team-role-icon">
                <img src="icons/offlane.png" class="team-role-icon">
                <img src="icons/soft-support.png" class="team-role-icon">
                <img src="icons/hard-support.png" class="team-role-icon">
            </span>
        `;
    }

    if (r.includes("safelane") || r.includes("carry")) {
        return `<img src="icons/safelane.png" class="team-role-icon">`;
    }

    if (r.includes("mid")) {
        return `<img src="icons/midlane.png" class="team-role-icon">`;
    }

    if (r.includes("offlane")) {
        return `<img src="icons/offlane.png" class="team-role-icon">`;
    }

    if (r.includes("hard support") || r.includes("hardsupport")) {
        return `<img src="icons/hard-support.png" class="team-role-icon">`;
    }

    if (r.includes("support")) {
        return `<img src="icons/soft-support.png" class="team-role-icon">`;
    }

    return "";
}

function renderDraftTeams() {
    const draftTeams = document.getElementById("draft-teams");
    draftTeams.innerHTML = "";

    if (shuffledCaptains.length === 0) return;

    const activeTeamIndex =
        !draftComplete ? getNextValidTeamIndex() : null;

    shuffledCaptains.forEach((captain, index) => {
        const teamCard = document.createElement("div");

        teamCard.className = "team-card";

        if (index === activeTeamIndex) {
            teamCard.classList.add("active-team");
        }

        const teamMembers = draftedPlayers.filter(player => player.teamIndex === index);

        let membersHtml = `
            <div class="team-player captain-row">
    <span>${captain.name}</span>
    <span>${captain.rank}</span>
    <span>
        <img src="icons/captain.png" class="team-role-icon">
        ${getRoleIcon(captain.role)}
    </span>
</div>
        `;

       teamMembers.forEach(member => {
    membersHtml += `
        <div class="team-player">
            <span>${member.name}</span>
            <span>${member.rank}</span>
            <span>
                ${getRoleIcon(member.role)}
            </span>
        </div>
    `;
});

        teamCard.innerHTML = `
            <h3>${captain.name} Team</h3>
            ${membersHtml}
        `;

        draftTeams.appendChild(teamCard);
    });
}

function renderPickHistory() {
    const historyBox = document.getElementById("pick-history");

    if (!historyBox) return;

    historyBox.innerHTML = "";

    if (draftedPlayers.length === 0) {
        historyBox.innerHTML = `
            <div class="pick-history-item">
                No picks yet.
            </div>
        `;
        return;
    }

    draftedPlayers.forEach((player, index) => {
        const captain = shuffledCaptains[player.teamIndex];

        const item = document.createElement("div");
        item.className = "pick-history-item";

        item.innerHTML = `
            ${index + 1}.
            <span class="pick-history-team">${captain.name} Team</span>
            picked ${player.name} (${player.rank})
        `;

        historyBox.appendChild(item);
    });
}

function togglePickHistory() {
    document.getElementById("history-widget").classList.toggle("open");
}

function undoLastPick() {
    if (draftedPlayers.length === 0) return;

    draftedPlayers.pop();

    draftPickIndex = Math.max(draftPickIndex - 1, 0);
    draftComplete = false;

    renderDraftStatus();
    renderPools();
    renderDraftTeams();
    renderPickHistory();
    saveTeamsToSheet();
}

function resetDraft() {
    shuffledCaptains = [];
    draftedPlayers = [];
    draftPickIndex = 0;
    draftComplete = false;

    document.body.classList.remove("drafting-started");

    renderCaptains();
    renderPools();
    renderDraftTeams();
    renderPickHistory();

    document.getElementById("draft-message").innerHTML = "Draft reset.";

    clearSavedTeams();
}

async function saveTeamsToSheet() {
    for (const drafted of draftedPlayers) {
        const player = players.find(p => p.name === drafted.name);
        if (!player) continue;

        const teamName = `${shuffledCaptains[drafted.teamIndex].name} Team`;

        const url =
            `${APPS_SCRIPT_URL}` +
            `?row=${player.rowNumber}` +
            `&field=finalTeam` +
            `&value=${encodeURIComponent(teamName)}`;

        await fetch(url, {
            method: "GET",
            mode: "no-cors"
        });
    }

    for (let index = 0; index < shuffledCaptains.length; index++) {
        const captain = shuffledCaptains[index];

        const player = players.find(p => p.name === captain.name);
        if (!player) continue;

        const teamName = `${captain.name} Team`;

        const url =
            `${APPS_SCRIPT_URL}` +
            `?row=${player.rowNumber}` +
            `&field=finalTeam` +
            `&value=${encodeURIComponent(teamName)}`;

        await fetch(url, {
            method: "GET",
            mode: "no-cors"
        });
    }
}

async function clearSavedTeams() {
    for (const player of players) {
        const url =
            `${APPS_SCRIPT_URL}` +
            `?row=${player.rowNumber}` +
            `&field=finalTeam` +
            `&value=`;

        await fetch(url, {
            method: "GET",
            mode: "no-cors"
        });
    }
}

async function updateAttendance(row, value) {
    const url =
        `${APPS_SCRIPT_URL}?row=${row}&field=attendance&value=${value}`;

    await fetch(url, {
        method: "GET",
        mode: "no-cors"
    });

    setTimeout(loadRoster, 1000);
}

async function setAllAttendance(value) {

    const checkboxes = document.querySelectorAll(
        '#roster input[type="checkbox"]'
    );

    checkboxes.forEach(checkbox => {
        checkbox.checked = value;
    });

    players.forEach(player => {
        player.attendance = value;
    });

    renderPools();

    for (const player of players) {

        const url =
            `${APPS_SCRIPT_URL}?row=${player.rowNumber}&field=attendance&value=${value}`;

        fetch(url, {
            method: "GET",
            mode: "no-cors"
        });
    }
}

document.getElementById("search").addEventListener("input", function () {
    const value = this.value.toLowerCase();
    const rows = document.querySelectorAll("#roster tr");

    rows.forEach(row => {
        row.style.display =
            row.innerText.toLowerCase().includes(value) ? "" : "none";
    });
});

loadRoster();