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
// CSV columns: 0:Opener, 1:Region, 2:Seed, 3:Team,
// 4:Jud bid, 5:Bob bid, 6:Fletch bid, 7:Owner, 8:Round label,
// 9:Rd1(5), 10:Rd2(10), 11:S16(15), 12:E8(20), 13:F4(25), 14:NCG(30)
function parseAuctionData(rows) {
    const teams = [];
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
        let owner = (row[7] || '').trim();

        // Fix #N/A or invalid owners: determine from highest bid
        if (!['Jud', 'Bob', 'Fletch'].includes(owner)) {
            const maxBid = Math.max(judBid, bobBid, fletchBid);
            if (maxBid > 0) {
                if (judBid === maxBid) owner = 'Jud';
                else if (bobBid === maxBid) owner = 'Bob';
                else owner = 'Fletch';
            }
        }

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

        // Determine price from winning bidder
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

// Parse history data from CSV
function parseHistoryData(rows) {
    const history = {
        summary: { Jud: {}, Bob: {}, Fletch: {} },
        years: []
    };

    // Hardcoded overrides for years with missing data
    const knownWinners = { 2002: 'Jud', 2009: 'Fletch' };
    const yearNotes = { 2020: 'No data \u2014 COVID cancelled tournament' };

    let summaryIdx = 0;
    const summaryLabels = ['wins', 'second', 'third', 'points'];
    for (let i = 0; i < rows.length; i++) {
        const col1 = (rows[i][1] || '').trim();
        const col2 = (rows[i][2] || '').trim();

        const year = parseInt(col1);
        if (year >= 2000 && year <= 2030) {
            const jud = (rows[i][2] || '').trim();
            const bob = (rows[i][3] || '').trim();
            const fletch = (rows[i][4] || '').trim();

            if (jud === '' && bob === '' && fletch === '') {
                const note = yearNotes[year] || (knownWinners[year] ? knownWinners[year] + ' won' : 'No data');
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

        // Summary rows
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

    // Override summary wins to count hardcoded winners
    // Count actual wins from year data (including hardcoded winners)
    const winCounts = { Jud: 0, Bob: 0, Fletch: 0 };
    for (const y of history.years) {
        if (y.winner) {
            for (const name of y.winner.split(' / ')) {
                const trimmed = name.trim();
                if (winCounts[trimmed] !== undefined) winCounts[trimmed]++;
            }
        }
    }
    history.summary.Jud.wins = winCounts.Jud;
    history.summary.Bob.wins = winCounts.Bob;
    history.summary.Fletch.wins = winCounts.Fletch;

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

    for (const player of ['jud', 'bob', 'fletch']) {
        const p = player.charAt(0).toUpperCase() + player.slice(1);
        document.getElementById(`sim-${player}-pct`).textContent =
            (results.playerWinPct[p] * 100).toFixed(1) + '%';
        document.getElementById(`sim-${player}-ev`).textContent =
            'E[pts]: ' + results.playerExpectedPoints[p].toFixed(1);
    }

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

// Render the scenario comparison suite (Normal + forced winners grid)
function renderSimSuite(suiteResults) {
    const container = document.getElementById('sim-suite-results');
    container.classList.remove('hidden');

    const scenarios = Object.keys(suiteResults);
    const thead = document.getElementById('sim-suite-head');
    const tbody = document.getElementById('sim-suite-body');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Header row: blank | scenario names
    let headerRow = '<tr><th></th>';
    for (const sc of scenarios) {
        const label = sc === 'Normal' ? 'Current' : sc;
        // Find owner for forced winner teams
        let ownerLabel = '';
        if (sc !== 'Normal') {
            const teamInfo = auctionData.find(t => t.team === sc);
            if (teamInfo) ownerLabel = ` (${teamInfo.owner})`;
        }
        headerRow += `<th colspan="2">${label}${ownerLabel}</th>`;
    }
    headerRow += '</tr>';

    // Sub-header: Win% | E[pts] for each
    let subHeader = '<tr><th></th>';
    for (const sc of scenarios) {
        subHeader += '<th>Win%</th><th>E[pts]</th>';
    }
    subHeader += '</tr>';
    thead.innerHTML = headerRow + subHeader;

    // Player rows
    for (const player of ['Jud', 'Bob', 'Fletch']) {
        const colorClass = `owner-${player.toLowerCase()}`;
        let row = `<tr><td class="${colorClass}" style="font-weight:700;">${player}</td>`;
        for (const sc of scenarios) {
            const r = suiteResults[sc];
            const winPct = (r.playerWinPct[player] * 100).toFixed(1);
            const ePts = r.playerExpectedPoints[player].toFixed(1);
            row += `<td class="points-cell">${winPct}%</td><td>${ePts}</td>`;
        }
        row += '</tr>';
        tbody.innerHTML += row;
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

// Populate force winner dropdown
function populateForceWinner(teams) {
    const select = document.getElementById('sim-force-winner');
    select.innerHTML = '<option value="">None</option>';
    const sorted = [...teams].sort((a, b) => a.seed - b.seed || a.team.localeCompare(b.team));
    for (const t of sorted) {
        const opt = document.createElement('option');
        opt.value = t.team;
        opt.textContent = `${t.seed} ${t.team} (${t.owner})`;
        select.appendChild(opt);
    }
}

// Get the 1-seeds and 2-seeds for sim suite scenarios
function getTopSeeds(teams) {
    const seeds = [];
    const sorted = [...teams].sort((a, b) => a.seed - b.seed || a.region.localeCompare(b.region));
    for (const t of sorted) {
        if (t.seed === 1 || t.seed === 2) {
            seeds.push(t.team);
        }
    }
    return seeds;
}

// Determine simulation mode from dropdown
function getSimMode() {
    const val = document.getElementById('sim-start').value;
    if (val === 'pre' || val === 'current') return val;
    return parseInt(val); // 1,2,3,4 = after round N
}

// Simulation button handler
document.getElementById('run-sim').addEventListener('click', async () => {
    if (auctionData.length === 0) {
        alert('No auction data loaded yet. Please wait for data to load.');
        return;
    }

    const numSims = parseInt(document.getElementById('sim-count').value);
    const k = parseFloat(document.getElementById('sim-k').value);
    const forcedWinner = document.getElementById('sim-force-winner').value || null;
    const mode = getSimMode();
    const btn = document.getElementById('run-sim');
    const progressDiv = document.getElementById('sim-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    btn.disabled = true;
    progressDiv.classList.remove('hidden');
    document.getElementById('sim-suite-results').classList.add('hidden');

    const simData = auctionData.map(t => ({...t}));

    // Run main simulation
    const results = await runMonteCarlo(simData, numSims, k, (pct) => {
        progressFill.style.width = (pct * 100) + '%';
        progressText.textContent = `Running main sim... ${Math.round(pct * 100)}%`;
    }, forcedWinner, mode);

    renderSimResults(results);

    // Now run the suite: Normal + each 1-seed and 2-seed forced winner
    const topSeeds = getTopSeeds(auctionData);
    progressText.textContent = 'Running scenario suite (Normal + top seeds)...';
    const suiteSimCount = Math.min(numSims, 5000); // cap suite at 5000 per scenario for speed

    // Suite always runs with 'current' mode regardless of main sim starting point
    const suiteResults = await runSimSuite(simData, suiteSimCount, k, 'current', topSeeds, (pct) => {
        progressFill.style.width = (pct * 100) + '%';
        progressText.textContent = `Running scenario suite... ${Math.round(pct * 100)}%`;
    });

    renderSimSuite(suiteResults);

    progressText.textContent = `Complete! (${numSims.toLocaleString()} sims + ${topSeeds.length + 1} scenarios @ ${suiteSimCount.toLocaleString()} each)`;
    btn.disabled = false;
});

// Fetch live NCAA tournament results from ESPN API
async function fetchESPNResults() {
    // Tournament dates: R1 Mar 19-20, R2 Mar 21-22, S16 Mar 26-27, E8 Mar 28-29, F4 Apr 4, NCG Apr 6
    const tourneyDates = [
        '20260319', '20260320', '20260321', '20260322',
        '20260326', '20260327', '20260328', '20260329',
        '20260404', '20260406'
    ];
    const allGames = [];
    for (const d of tourneyDates) {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${d}&groups=100&limit=50`;
            const resp = await fetch(url);
            const data = await resp.json();
            allGames.push(...(data.events || []));
        } catch (e) { /* skip date if fetch fails */ }
    }
    return allGames;
}

// Map ESPN round note to round index (0=R64, 1=R32, 2=S16, 3=E8, 4=F4, 5=NCG)
function parseRoundFromNote(note) {
    if (note.includes('1st Round')) return 0;
    if (note.includes('2nd Round')) return 1;
    if (note.includes('Sweet') || note.includes('Regional Semifinal')) return 2;
    if (note.includes('Elite') || note.includes('Regional Final')) return 3;
    if (note.includes('Final Four') || note.includes('National Semifinal')) return 4;
    if (note.includes('National Championship')) return 5;
    return -1;
}

// Fuzzy match ESPN team name to auction team name
function matchTeamName(espnName, auctionTeams) {
    const lower = espnName.toLowerCase().replace(/[^a-z]/g, '');
    // Try exact match first
    for (const t of auctionTeams) {
        if (t.team.toLowerCase() === espnName.toLowerCase()) return t;
        if (t.team.toLowerCase().replace(/[^a-z]/g, '') === lower) return t;
    }
    // Try partial/starts-with match
    for (const t of auctionTeams) {
        const tLower = t.team.toLowerCase().replace(/[^a-z]/g, '');
        if (tLower.startsWith(lower) || lower.startsWith(tLower)) return t;
        // Try common abbreviations
        if (lower.includes(tLower) || tLower.includes(lower)) return t;
    }
    return null;
}

// Update Results button - fetch live scores from ESPN
document.getElementById('update-results').addEventListener('click', async () => {
    const btn = document.getElementById('update-results');
    btn.disabled = true;
    btn.textContent = 'Fetching scores...';
    try {
        const games = await fetchESPNResults();
        let updated = 0;

        for (const event of games) {
            const comp = event.competitions[0];
            const status = comp.status.type.name;
            if (status !== 'STATUS_FINAL') continue; // Only use final results

            const notes = (comp.notes || []).map(n => n.headline).join(' ');
            const roundIdx = parseRoundFromNote(notes);
            if (roundIdx < 0) continue;

            for (const competitor of comp.competitors) {
                const espnName = competitor.team.shortDisplayName || competitor.team.displayName;
                const matched = matchTeamName(espnName, auctionData);
                if (!matched) continue;

                const won = competitor.winner === true;
                const currentVal = matched.roundResults[roundIdx];
                const newVal = won ? ROUND_POINTS[roundIdx] : 0;

                if (currentVal === null || currentVal === undefined) {
                    matched.roundResults[roundIdx] = newVal;
                    updated++;
                }
            }
        }

        // Recalculate knownPoints and eliminated for all teams
        for (const t of auctionData) {
            t.knownPoints = 0;
            t.eliminated = false;
            t.roundWins = 0;
            for (let r = 0; r < t.roundResults.length; r++) {
                if (t.roundResults[r] !== null && t.roundResults[r] > 0) {
                    t.knownPoints += t.roundResults[r];
                    t.roundWins++;
                } else if (t.roundResults[r] !== null && t.roundResults[r] === 0) {
                    t.eliminated = true;
                    break;
                }
            }
        }

        renderScoreboard(auctionData);
        renderAuctionTable(auctionData);
        populateForceWinner(auctionData);

        btn.textContent = updated > 0 ? `Updated ${updated} results!` : 'All up to date!';
        setTimeout(() => { btn.textContent = 'Update Results'; btn.disabled = false; }, 3000);
    } catch (err) {
        btn.textContent = 'Error - try again';
        btn.disabled = false;
        console.error('Update failed:', err);
    }
});

// Load data on page load
async function loadData() {
    try {
        const auctionRows = await fetchCSV(sheetCSVUrl('2026 Auction'));
        auctionData = parseAuctionData(auctionRows);
        renderScoreboard(auctionData);
        renderAuctionTable(auctionData);
        populateForceWinner(auctionData);

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
