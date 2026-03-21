// NCAA Auction Game - Main Application
const SHEET_ID = '123GLGuyiDz4kNDVJKnLrV-9HnWEe0etqOCqQqw876u0';

function sheetCSVUrl(sheetName) {
    const encoded = encodeURIComponent(sheetName);
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encoded}`;
}

async function fetchCSV(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
    const text = await resp.text();
    return parseCSV(text);
}

function parseCSV(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    let row = [];

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"' && text[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(current.trim());
                current = '';
            } else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                row.push(current.trim());
                if (row.some(c => c !== '')) rows.push(row);
                row = [];
                current = '';
            } else {
                current += ch;
            }
        }
    }
    if (current || row.length) {
        row.push(current.trim());
        if (row.some(c => c !== '')) rows.push(row);
    }
    return rows;
}

// Parse auction data from CSV
// CSV columns from Google Sheets:
// 0: Opener, 1: Region, 2: Seed, 3: Team,
// 4: Jud bid, 5: Bob bid, 6: Fletch bid,
// 7: Owner, 8: Round (payout label),
// 9: Rd1(5), 10: Rd2(10), 11: S16(15), 12: E8(20), 13: F4(25), 14: NCG(30)
function parseAuctionData(rows) {
    const teams = [];
    // Row 0 = header, Row 1 = totals, Rows 2+ = team data
    for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4) continue;
        const team = (row[3] || '').trim();
        if (!team) continue;

        const opener = (row[0] || '').trim();
        const region = (row[1] || '').trim();
        const seed = parseInt(row[2]) || 0;
        const judBid = parseFloat(row[4]) || 0;
        const bobBid = parseFloat(row[5]) || 0;
        const fletchBid = parseFloat(row[6]) || 0;
        const owner = (row[7] || '').trim();

        // Round results: columns 9-14
        const roundResults = [];
        for (let r = 9; r <= 14; r++) {
            const val = (row[r] || '').trim();
            if (val === '') {
                roundResults.push(null);
            } else {
                roundResults.push(parseFloat(val));
            }
        }

        // Determine price paid — it's the bid amount from the winning bidder
        let price = 0;
        if (owner === 'Jud') price = judBid;
        else if (owner === 'Bob') price = bobBid;
        else if (owner === 'Fletch') price = fletchBid;

        // Calculate known points from round results
        let knownPoints = 0;
        let eliminated = false;
        let roundWins = 0;
        for (let r = 0; r < roundResults.length; r++) {
            if (roundResults[r] !== null && roundResults[r] > 0) {
                knownPoints += roundResults[r];
                roundWins++;
            } else if (roundResults[r] !== null && roundResults[r] === 0) {
                eliminated = true;
                break;
            }
        }

        const rpi = lookupRPI(team);

        teams.push({
            opener, region, seed, team, owner, price,
            roundResults, knownPoints, eliminated, roundWins,
            rpi, judBid, bobBid, fletchBid
        });
    }
    return teams;
}

// Parse standings data (alternative format)
function parseStandingsData(rows) {
    // The standings sheet has a different format - 3 player columns
    // For now we'll primarily use the auction sheet
    return rows;
}

// Parse history data from CSV
// CSV format: col0=blank, col1=year or "Summary of Results", col2=Jud, col3=Bob, col4=Fletch
// Row 0: header with "Summary of Results"
// Rows 1-4: summary stats (Wins, 2nd, 3rd, Points) - just numbers, no labels in CSV
// Rows 5+: year-by-year data
function parseHistoryData(rows) {
    const history = {
        summary: { Jud: {}, Bob: {}, Fletch: {} },
        years: []
    };

    // The CSV from Google Sheets strips the cell formatting.
    // Row 0: header ("", "Summary of Results", "Jud", "Bob", "Fletch")
    // Row 1: Wins values
    // Row 2: 2nd place values
    // Row 3: 3rd place values
    // Row 4: Points values
    // Then year rows follow

    // Find summary rows and year rows
    let summaryIdx = 0;
    const summaryLabels = ['wins', 'second', 'third', 'points'];
    for (let i = 0; i < rows.length; i++) {
        const col1 = (rows[i][1] || '').trim();
        const col2 = (rows[i][2] || '').trim();

        // Check if this is a year row first
        const year = parseInt(col1);
        if (year >= 2000 && year <= 2030) {
            const jud = (rows[i][2] || '').trim();
            const bob = (rows[i][3] || '').trim();
            const fletch = (rows[i][4] || '').trim();

            if (jud === '' && bob === '' && fletch === '') {
                // Hardcoded known winners for years without score data
                const knownWinners = { 2002: 'Jud' };
                const note = knownWinners[year] ? knownWinners[year] + ' won' : 'No data';
                const winner = knownWinners[year] || null;
                history.years.push({ year, jud: null, bob: null, fletch: null, note, winner });
            } else {
                const judPts = parseInt(jud) || 0;
                const bobPts = parseInt(bob) || 0;
                const fletchPts = parseInt(fletch) || 0;
                const maxPts = Math.max(judPts, bobPts, fletchPts);
                let winner = null;
                if (maxPts > 0) {
                    const winners = [];
                    if (judPts === maxPts) winners.push('Jud');
                    if (bobPts === maxPts) winners.push('Bob');
                    if (fletchPts === maxPts) winners.push('Fletch');
                    winner = winners.join(' / ');
                }
                history.years.push({ year, jud: judPts, bob: bobPts, fletch: fletchPts, winner });
            }
            continue;
        }

        // Summary rows: blank col1 with numbers in col2
        if (summaryIdx < 4 && (col1.includes('Summary') || col1 === 'Jud' || col1 === '')) {
            if (col2 !== '' && col2 !== 'Jud' && !isNaN(parseInt(col2))) {
                const label = summaryLabels[summaryIdx];
                history.summary.Jud[label] = parseInt(rows[i][2]) || 0;
                history.summary.Bob[label] = parseInt(rows[i][3]) || 0;
                history.summary.Fletch[label] = parseInt(rows[i][4]) || 0;
                summaryIdx++;
            }
        }
    }

    return history;
}

// Render functions
function renderScoreboard(teams) {
    const scores = { Jud: 0, Bob: 0, Fletch: 0 };
    const spent = { Jud: 0, Bob: 0, Fletch: 0 };
    const teamCount = { Jud: 0, Bob: 0, Fletch: 0 };

    for (const t of teams) {
        if (scores[t.owner] !== undefined) {
            scores[t.owner] += t.knownPoints;
            spent[t.owner] += t.price;
            teamCount[t.owner]++;
        }
    }

    for (const player of ['jud', 'bob', 'fletch']) {
        const p = player.charAt(0).toUpperCase() + player.slice(1);
        document.getElementById(`${player}-points`).textContent = scores[p];
        document.getElementById(`${player}-spent`).textContent = '$' + spent[p];
        document.getElementById(`${player}-teams`).textContent = teamCount[p];
    }
}

function renderAuctionTable(teams) {
    const tbody = document.getElementById('auction-body');
    tbody.innerHTML = '';

    // Sort by seed, then region
    const sorted = [...teams].sort((a, b) => a.seed - b.seed || a.region.localeCompare(b.region));

    for (const t of sorted) {
        const tr = document.createElement('tr');
        if (t.eliminated) tr.classList.add('eliminated-row');

        const ownerClass = `owner-${t.owner.toLowerCase()}`;
        const roundCells = t.roundResults.map((r, i) => {
            if (r === null) return '<td>-</td>';
            if (r > 0) return `<td class="round-won">${ROUND_POINTS[i]}</td>`;
            return `<td class="round-lost">0</td>`;
        }).join('');

        tr.innerHTML = `
            <td>${t.opener}</td>
            <td>${t.region}</td>
            <td>${t.seed}</td>
            <td>${t.eliminated ? '<span class="eliminated">' + t.team + '</span>' : t.team}</td>
            <td class="${ownerClass}">${t.owner}</td>
            <td>$${t.price}</td>
            <td>${t.rpi ? t.rpi.toFixed(3) : '?'}</td>
            ${roundCells}
            <td class="points-cell">${t.knownPoints}</td>
        `;
        tbody.appendChild(tr);
    }
}

function renderHistory(history) {
    // Summary cards
    const summaryDiv = document.getElementById('all-time-summary');
    summaryDiv.innerHTML = '';
    for (const [player, color] of [['Jud', 'jud'], ['Bob', 'bob'], ['Fletch', 'fletch']]) {
        const s = history.summary[player];
        const card = document.createElement('div');
        card.className = `summary-card ${color}-bg`;
        card.innerHTML = `
            <div class="player-name" style="margin-bottom: 0.75rem;">${player}</div>
            <div class="stat">${s.wins || 0}</div>
            <div class="stat-label">Wins</div>
            <div style="display:flex; justify-content:center; gap:1.5rem; margin-top:0.75rem;">
                <div><span style="font-weight:700;">${s.second || 0}</span><br><span class="stat-label">2nd</span></div>
                <div><span style="font-weight:700;">${s.third || 0}</span><br><span class="stat-label">3rd</span></div>
                <div><span style="font-weight:700;">${s.points || 0}</span><br><span class="stat-label">Total Pts</span></div>
            </div>
        `;
        summaryDiv.appendChild(card);
    }

    // Year-by-year table
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '';
    for (const y of history.years) {
        const tr = document.createElement('tr');
        if (y.jud === null) {
            tr.innerHTML = `
                <td>${y.year}</td>
                <td colspan="3" style="color:var(--text-muted); font-style:italic;">${y.note || 'No data'}</td>
                <td class="winner-cell">${y.winner || '-'}</td>
            `;
        } else {
            const maxPts = Math.max(y.jud, y.bob, y.fletch);
            tr.innerHTML = `
                <td>${y.year}</td>
                <td class="${y.jud === maxPts && maxPts > 0 ? 'owner-jud points-cell' : ''}">${y.jud}</td>
                <td class="${y.bob === maxPts && maxPts > 0 ? 'owner-bob points-cell' : ''}">${y.bob}</td>
                <td class="${y.fletch === maxPts && maxPts > 0 ? 'owner-fletch points-cell' : ''}">${y.fletch}</td>
                <td class="winner-cell ${y.winner ? 'owner-' + y.winner.toLowerCase().split(' ')[0] : ''}">${y.winner || '-'}</td>
            `;
        }
        tbody.appendChild(tr);
    }
}

function renderSimResults(results) {
    const container = document.getElementById('sim-results');
    container.classList.remove('hidden');

    // Win percentages
    for (const player of ['jud', 'bob', 'fletch']) {
        const p = player.charAt(0).toUpperCase() + player.slice(1);
        document.getElementById(`sim-${player}-pct`).textContent =
            (results.playerWinPct[p] * 100).toFixed(1) + '%';
        document.getElementById(`sim-${player}-ev`).textContent =
            'E[pts]: ' + results.playerExpectedPoints[p].toFixed(1);
    }

    // Team table
    const tbody = document.getElementById('sim-team-body');
    tbody.innerHTML = '';
    const teamArr = Object.entries(results.teamStats)
        .sort((a, b) => b[1].champPct - a[1].champPct);

    for (const [team, stats] of teamArr) {
        const ownerClass = `owner-${(stats.owner || '').toLowerCase()}`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${team}</td>
            <td class="${ownerClass}">${stats.owner}</td>
            <td>${stats.seed}</td>
            <td>${stats.rpi ? stats.rpi.toFixed(3) : '?'}</td>
            <td class="points-cell">${(stats.champPct * 100).toFixed(1)}%</td>
            <td>${(stats.f4Pct * 100).toFixed(1)}%</td>
            <td>${stats.avgPoints.toFixed(1)}</td>
        `;
        tbody.appendChild(tr);
    }
}

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
    });
});

// Global state
let auctionData = [];

// Populate force winner dropdown with loaded teams
function populateForceWinner(teams) {
    const select = document.getElementById('sim-force-winner');
    // Keep the "None" option, clear the rest
    select.innerHTML = '<option value="">None</option>';
    // Sort by seed then team name
    const sorted = [...teams].sort((a, b) => a.seed - b.seed || a.team.localeCompare(b.team));
    for (const t of sorted) {
        const opt = document.createElement('option');
        opt.value = t.team;
        opt.textContent = `${t.seed} ${t.team} (${t.owner})`;
        select.appendChild(opt);
    }
}

// Simulation button
document.getElementById('run-sim').addEventListener('click', async () => {
    if (auctionData.length === 0) {
        alert('No auction data loaded yet. Please wait for data to load.');
        return;
    }

    const numSims = parseInt(document.getElementById('sim-count').value);
    const k = parseFloat(document.getElementById('sim-k').value);
    const forcedWinner = document.getElementById('sim-force-winner').value || null;
    const btn = document.getElementById('run-sim');
    const progressDiv = document.getElementById('sim-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    btn.disabled = true;
    progressDiv.classList.remove('hidden');

    const simData = auctionData.map(t => ({...t}));

    const results = await runMonteCarlo(simData, numSims, k, (pct) => {
        progressFill.style.width = (pct * 100) + '%';
        progressText.textContent = `Running... ${Math.round(pct * 100)}%`;
    }, forcedWinner);

    progressText.textContent = `Complete! (${numSims.toLocaleString()} simulations)`;
    btn.disabled = false;
    renderSimResults(results);
});

// Load data on page load
async function loadData() {
    try {
        // Load auction data
        const auctionRows = await fetchCSV(sheetCSVUrl('2026 Auction'));
        auctionData = parseAuctionData(auctionRows);
        renderScoreboard(auctionData);
        renderAuctionTable(auctionData);
        populateForceWinner(auctionData);

        // Load history
        const historyRows = await fetchCSV(sheetCSVUrl('History'));
        const history = parseHistoryData(historyRows);
        renderHistory(history);

    } catch (err) {
        console.error('Error loading data:', err);
        document.querySelector('main').innerHTML = `
            <div style="text-align:center; padding:3rem;">
                <h2>Unable to load data</h2>
                <p style="color:var(--text-muted); margin-top:1rem;">
                    Could not fetch data from Google Sheets.<br>
                    Make sure the spreadsheet is publicly shared.<br>
                    Error: ${err.message}
                </p>
            </div>
        `;
    }
}

loadData();
