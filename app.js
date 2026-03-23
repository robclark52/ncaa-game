// NCAA Auction Game - Main Application
const GITHUB_REPO = 'robclark52/ncaa-game';
const RESULTS_FILE = 'results.json';

// ─── GitHub Contents API helpers ─────────────────────────────────────

function getGitHubPAT() {
    let pat = localStorage.getItem('ncaa_github_pat');
    if (!pat) {
        pat = prompt(
            'Enter your GitHub Personal Access Token (PAT) to enable saving results.\n\n' +
            'The token needs "public_repo" scope. It will be stored in your browser\'s localStorage and never shared.\n\n' +
            'Create one at: https://github.com/settings/tokens'
        );
        if (pat) localStorage.setItem('ncaa_github_pat', pat.trim());
    }
    return pat ? pat.trim() : null;
}

async function fetchResultsFromGitHub() {
    try {
        // Fetch raw file from repo (no auth needed for public repo)
        const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${RESULTS_FILE}?t=${Date.now()}`;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) {
        console.log('No existing results.json found or parse error:', e.message);
        return null;
    }
}

async function commitResultsToGitHub(resultsObj) {
    const pat = getGitHubPAT();
    if (!pat) {
        alert('GitHub PAT is required to save results. Please try again.');
        return false;
    }

    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${RESULTS_FILE}`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(resultsObj, null, 2))));

    // Get current file SHA (needed for update; null if file doesn't exist yet)
    let sha = null;
    try {
        const existing = await fetch(apiUrl, {
            headers: { 'Authorization': `token ${pat}` }
        });
        if (existing.ok) {
            const data = await existing.json();
            sha = data.sha;
        }
    } catch (e) { /* file may not exist yet */ }

    const body = {
        message: `Update tournament results - ${new Date().toLocaleString()}`,
        content: content
    };
    if (sha) body.sha = sha;

    const resp = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${pat}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 401) {
            localStorage.removeItem('ncaa_github_pat');
            alert('Invalid GitHub PAT. It has been cleared. Please try again.');
        } else {
            alert(`Failed to save results: ${err.message || resp.statusText}`);
        }
        return false;
    }
    return true;
}

// Build a results.json object from current auctionData
function buildResultsJSON(teams) {
    const results = {
        lastUpdated: new Date().toISOString(),
        teams: {}
    };
    for (const t of teams) {
        results.teams[t.team] = {
            roundResults: [...t.roundResults],
            eliminated: t.eliminated,
            knownPoints: t.knownPoints
        };
    }
    return results;
}

// Apply saved results.json data onto auction teams
function applyStoredResults(teams, stored) {
    if (!stored || !stored.teams) return;
    for (const t of teams) {
        const saved = stored.teams[t.team];
        if (!saved) continue;
        // Overlay stored round results onto team (only non-null values)
        for (let r = 0; r < saved.roundResults.length && r < t.roundResults.length; r++) {
            if (saved.roundResults[r] !== null && saved.roundResults[r] !== undefined) {
                t.roundResults[r] = saved.roundResults[r];
            }
        }
    }
    // Recalculate derived fields
    recalcTeamStats(teams);
}

// Recalculate knownPoints, eliminated, roundWins from roundResults
function recalcTeamStats(teams) {
    for (const t of teams) {
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
}

// Build auctionData from static AUCTION_DATA + RPI lookup
function buildAuctionData() {
    return AUCTION_DATA.map(t => ({
        ...t,
        rpi: lookupRPI(t.team),
        roundResults: [null, null, null, null, null, null],
        knownPoints: 0,
        eliminated: false,
        roundWins: 0
    }));
}

// Render functions
function renderScoreboard(teams) {
    const scores = { Jud: 0, Bob: 0, Fletch: 0 };
    const spent = { Jud: 0, Bob: 0, Fletch: 0 };
    const teamCount = { Jud: 0, Bob: 0, Fletch: 0 };

    for (const t of teams) {
        if (t.owner && scores[t.owner] !== undefined) {
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
        const ownerClass = t.owner ? `owner-${t.owner.toLowerCase()}` : '';
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
            <td class="${ownerClass}">${t.owner || '—'}</td>
            <td>${t.price > 0 ? '$' + t.price : '—'}</td>
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
        const ownerClass = stats.owner ? `owner-${stats.owner.toLowerCase()}` : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${team}</td>
            <td class="${ownerClass}">${stats.owner || '—'}</td>
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
function renderSimSuite(suiteResults, mode) {
    const container = document.getElementById('sim-suite-results');
    container.classList.remove('hidden');

    // Build a human-readable label for the "Normal" (baseline) scenario
    const modeLabels = {
        'pre': 'Pre-Tournament',
        'current': 'Current Results',
        1: 'After Rd 1',
        2: 'After Rd 2',
        3: 'After Sweet 16',
        4: 'After Elite 8'
    };
    const baselineLabel = modeLabels[mode] || 'Current Results';

    const scenarios = Object.keys(suiteResults);
    const thead = document.getElementById('sim-suite-head');
    const tbody = document.getElementById('sim-suite-body');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Determine which scenarios are for eliminated teams
    const eliminatedScenarios = new Set();
    for (const sc of scenarios) {
        if (sc === 'Normal') continue;
        const teamInfo = auctionData.find(t => t.team === sc);
        if (teamInfo && teamInfo.eliminated) eliminatedScenarios.add(sc);
    }

    // Header row: blank | scenario names
    let headerRow = '<tr><th></th>';
    for (const sc of scenarios) {
        const label = sc === 'Normal' ? baselineLabel : sc;
        let ownerLabel = '';
        if (sc !== 'Normal') {
            const teamInfo = auctionData.find(t => t.team === sc);
            if (teamInfo && teamInfo.owner) ownerLabel = ` (${teamInfo.owner})`;
        }
        const elim = eliminatedScenarios.has(sc) ? ' style="color:var(--text-muted); text-decoration:line-through;"' : '';
        headerRow += `<th colspan="2"${elim}>${label}${ownerLabel}</th>`;
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
            if (eliminatedScenarios.has(sc)) {
                row += '<td style="color:var(--text-muted);">—</td><td style="color:var(--text-muted);">—</td>';
            } else {
                const r = suiteResults[sc];
                const winPct = (r.playerWinPct[player] * 100).toFixed(1);
                const ePts = r.playerExpectedPoints[player].toFixed(1);
                row += `<td class="points-cell">${winPct}%</td><td>${ePts}</td>`;
            }
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
        opt.textContent = `${t.seed} ${t.team}${t.owner ? ' (' + t.owner + ')' : ' (unowned)'}`;
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
    const model = document.getElementById('sim-model').value;
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
    }, forcedWinner, mode, model);

    renderSimResults(results);

    // Now run the suite: Normal + each 1-seed and 2-seed forced winner
    const topSeeds = getTopSeeds(auctionData);
    progressText.textContent = 'Running scenario suite (Normal + top seeds)...';
    const suiteSimCount = Math.min(numSims, 5000); // cap suite at 5000 per scenario for speed

    // Suite uses the same starting point as the main simulation
    const suiteResults = await runSimSuite(simData, suiteSimCount, k, mode, topSeeds, (pct) => {
        progressFill.style.width = (pct * 100) + '%';
        progressText.textContent = `Running scenario suite... ${Math.round(pct * 100)}%`;
    }, model);

    renderSimSuite(suiteResults, mode);

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

// Normalize team name: "State" ↔ "St.", "CA" → "Cal", strip punctuation, etc.
function normalizeName(name) {
    return name.toLowerCase().trim()
        .replace(/\bstate\b/g, 'st')
        .replace(/\bst\.\b/g, 'st')
        .replace(/\bca\b/g, 'cal')
        .replace(/\bn dakota\b/g, 'north dakota')
        .replace(/\bmia(?:mi)?\s*(?:oh|ohio)\b/g, 'miami ohio')
        .replace(/[^a-z ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Match ESPN team name to auction team name, using seed to disambiguate
function matchTeamName(espnName, espnSeed, auctionTeams) {
    const lower = espnName.toLowerCase().trim();
    const stripped = lower.replace(/[^a-z ]/g, '');
    const normalized = normalizeName(espnName);

    // 1. Exact match (case-insensitive)
    for (const t of auctionTeams) {
        if (t.team.toLowerCase().trim() === lower) return t;
    }

    // 2. Exact match after stripping punctuation
    for (const t of auctionTeams) {
        if (t.team.toLowerCase().replace(/[^a-z ]/g, '') === stripped) return t;
    }

    // 3. Normalized match (State↔St., CA→Cal, etc.)
    for (const t of auctionTeams) {
        if (normalizeName(t.team) === normalized) return t;
    }

    // 4. Seed-matched partial: only allow substring matching when seeds agree
    //    This prevents "Texas" from matching "Texas Tech"
    if (espnSeed) {
        const seedNum = parseInt(espnSeed);
        for (const t of auctionTeams) {
            if (t.seed !== seedNum) continue;
            const tNorm = normalizeName(t.team);
            if (tNorm.includes(normalized) || normalized.includes(tNorm)) return t;
        }
    }

    // 5. Check if ESPN name matches part of a combined play-in team name (e.g. "SMU / Miami (Ohio)")
    //    Match on the component parts split by "/"
    for (const t of auctionTeams) {
        if (!t.team.includes('/')) continue;
        const parts = t.team.split('/').map(p => normalizeName(p));
        if (parts.some(p => p === normalized || p.includes(normalized) || normalized.includes(p))) {
            // If seeds are available, verify they match too
            if (espnSeed && t.seed !== parseInt(espnSeed)) continue;
            return t;
        }
    }

    // 6. Fallback partial match using normalized names with word-boundary alignment
    for (const t of auctionTeams) {
        const tNorm = normalizeName(t.team);
        if (tNorm === normalized) return t;
        if (normalized.length > tNorm.length) {
            if (normalized.startsWith(tNorm) && (normalized[tNorm.length] === ' ' || normalized[tNorm.length] === undefined)) return t;
        } else if (tNorm.length > normalized.length) {
            if (tNorm.startsWith(normalized) && (tNorm[normalized.length] === ' ' || tNorm[normalized.length] === undefined)) return t;
        }
    }

    console.log(`No match found for ESPN team: "${espnName}" (seed ${espnSeed})`);
    return null;
}

// Update Results button - fetch live scores from ESPN and persist to GitHub
document.getElementById('update-results').addEventListener('click', async () => {
    const btn = document.getElementById('update-results');
    btn.disabled = true;
    btn.textContent = 'Fetching scores...';
    try {
        const games = await fetchESPNResults();
        let updated = 0;

        // Clear all round results first so we rebuild from ESPN as source of truth
        for (const t of auctionData) {
            t.roundResults = [null, null, null, null, null, null];
            t.knownPoints = 0;
            t.eliminated = false;
            t.roundWins = 0;
        }

        for (const event of games) {
            const comp = event.competitions[0];
            const status = comp.status.type.name;
            if (status !== 'STATUS_FINAL') continue;

            const notes = (comp.notes || []).map(n => n.headline).join(' ');
            const roundIdx = parseRoundFromNote(notes);
            if (roundIdx < 0) continue;

            for (const competitor of comp.competitors) {
                const espnName = competitor.team.shortDisplayName || competitor.team.displayName;
                const espnSeed = competitor.curatedRank?.current || competitor.seed || null;
                const matched = matchTeamName(espnName, espnSeed, auctionData);
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

        // Recalculate derived stats
        recalcTeamStats(auctionData);

        renderScoreboard(auctionData);
        renderAuctionTable(auctionData);
        populateForceWinner(auctionData);

        if (updated > 0) {
            // Persist updated results to GitHub
            btn.textContent = 'Saving to GitHub...';
            const resultsObj = buildResultsJSON(auctionData);
            const saved = await commitResultsToGitHub(resultsObj);
            btn.textContent = saved
                ? `Updated ${updated} results & saved!`
                : `Updated ${updated} results (save failed)`;
        } else {
            btn.textContent = 'All up to date!';
        }
        setTimeout(() => { btn.textContent = 'Update Results'; btn.disabled = false; }, 3000);
    } catch (err) {
        btn.textContent = 'Error - try again';
        btn.disabled = false;
        console.error('Update failed:', err);
    }
});

// ─── Model selection: show/hide k, update description ────
document.getElementById('sim-model').addEventListener('change', updateModelDesc);
function updateModelDesc() {
    const model = document.getElementById('sim-model').value;
    const kGroup = document.getElementById('k-group');
    const desc = document.getElementById('model-desc');
    if (model === 'rpi') {
        kGroup.style.display = '';
        desc.textContent = 'RPI Model: Win probability from logistic function of RPI difference. Higher k = more separation between favorites and underdogs.';
    } else {
        kGroup.style.display = 'none';
        desc.textContent = 'Seed Model: Win probability from historical seed-vs-seed matchup data (1985-2024, ~40 years).';
    }
}

// ─── Model Explainer ────────────────────────────────────
function renderExplainer() {
    document.getElementById('explainer-content').innerHTML = `
        <h2>Simulation Methodology</h2>

        <h3>Overview</h3>
        <p>This tool uses <strong>Monte Carlo simulation</strong> to estimate each player's probability of winning the NCAA Auction Game. It simulates the remaining tournament games thousands of times, scores each team based on how far it advances, tallies points by owner, and tracks win rates.</p>

        <h3>Auction Game Scoring</h3>
        <p>Points are awarded for each win, increasing by round:</p>
        <table class="explainer-table">
            <tr><th>Round</th><th>Points per Win</th><th>Games</th><th>Total Pts Available</th></tr>
            <tr><td>Round of 64</td><td>5</td><td>32</td><td>160</td></tr>
            <tr><td>Round of 32</td><td>10</td><td>16</td><td>160</td></tr>
            <tr><td>Sweet 16</td><td>15</td><td>8</td><td>120</td></tr>
            <tr><td>Elite 8</td><td>20</td><td>4</td><td>80</td></tr>
            <tr><td>Final Four</td><td>25</td><td>2</td><td>50</td></tr>
            <tr><td>Championship</td><td>30</td><td>1</td><td>30</td></tr>
            <tr><td><strong>Total</strong></td><td></td><td><strong>63</strong></td><td><strong>600</strong></td></tr>
        </table>
        <p>The tournament champion earns 5 + 10 + 15 + 20 + 25 + 30 = <strong>105 points</strong> total. All 600 points are distributed across the three players each year.</p>

        <h3>RPI Model</h3>
        <p>The RPI (Ratings Percentage Index) Model uses each team's RPI rating to compute win probabilities via a <strong>logistic function</strong>:</p>
        <div class="formula">P(A beats B) = 1 / (1 + 10<sup>(RPI<sub>B</sub> - RPI<sub>A</sub>) &times; k</sup>)</div>
        <p>Where:</p>
        <ul>
            <li><strong>RPI<sub>A</sub></strong>, <strong>RPI<sub>B</sub></strong> = RPI ratings for teams A and B (higher is better, typical range 0.4-0.7)</li>
            <li><strong>k</strong> = sensitivity parameter (default 7). Higher k means the model favors the higher-ranked team more strongly.</li>
        </ul>
        <p><strong>Example:</strong> Duke (RPI 0.690) vs a team with RPI 0.560, k=7:</p>
        <div class="formula">P(Duke) = 1 / (1 + 10<sup>(0.560 - 0.690) &times; 7</sup>) = 1 / (1 + 10<sup>-0.91</sup>) = 1 / (1 + 0.123) &asymp; <strong>89.0%</strong></div>
        <p>The logistic shape means small RPI differences yield near-50/50 odds, while larger gaps create more decisive probabilities.</p>

        <h3>Seed Model</h3>
        <p>The Seed Model uses <strong>historical win rates by seed matchup</strong> from all NCAA tournaments 1985-2024 (~40 years of data). For any matchup between seed X and seed Y, the model looks up the empirical win rate:</p>
        <div class="formula">P(Seed X beats Seed Y) = Historical Win Rate[X vs Y]</div>
        <p>Key historical rates:</p>
        <table class="explainer-table">
            <tr><th>Matchup</th><th>Higher Seed Win%</th><th>Notes</th></tr>
            <tr><td>1 vs 16</td><td>99.3%</td><td>Only 2 upsets ever (UMBC 2018, FDU 2023)</td></tr>
            <tr><td>2 vs 15</td><td>94.6%</td><td>Rare upsets (Oral Roberts 2021, St. Peter's 2022)</td></tr>
            <tr><td>1 vs 8/9</td><td>~80%</td><td>1-seeds dominant in Round of 32</td></tr>
            <tr><td>5 vs 12</td><td>64.9%</td><td>Famous "12-5 upset" spot</td></tr>
            <tr><td>1 vs 2 (late rounds)</td><td>50.8%</td><td>Nearly a coin flip</td></tr>
        </table>
        <p>When a specific seed matchup hasn't occurred historically, the model falls back to a seed-difference formula. This model ignores individual team strength and relies purely on seeding.</p>

        <h3>Starting Points</h3>
        <p>The simulation can begin from different points in the tournament:</p>
        <ul>
            <li><strong>Pre-Tournament</strong>: Simulates all 63 games from scratch</li>
            <li><strong>Current Results</strong>: Uses actual results so far, simulates remaining games only</li>
            <li><strong>After Round 1/2/etc.</strong>: Uses actual results through that round, simulates the rest</li>
        </ul>

        <h3>Scenario Comparison (Suite)</h3>
        <p>After each simulation run, a scenario suite automatically runs: one "Current" scenario plus one scenario for each 1-seed and 2-seed where that team is <strong>forced to win every game</strong>. This shows how each player's win probability shifts depending on which team wins the tournament.</p>

        <h3>Force Tournament Winner</h3>
        <p>The "Force Tournament Winner" dropdown overrides a single team to have 100% win probability in every game. This is useful for exploring "what if Duke wins it all?" scenarios and seeing how that changes the player standings.</p>
    `;
}

// Load data on page load
async function loadData() {
    try {
        // 1. Build auction data from static file (auction-data.js)
        auctionData = buildAuctionData();

        // 2. Apply persisted results from GitHub (sole source of truth for game results)
        try {
            const stored = await fetchResultsFromGitHub();
            if (stored) {
                applyStoredResults(auctionData, stored);
                console.log('Loaded results from GitHub (last updated:', stored.lastUpdated, ')');
            }
        } catch (e) {
            console.log('Could not load persisted results:', e.message);
        }

        renderScoreboard(auctionData);
        renderAuctionTable(auctionData);
        populateForceWinner(auctionData);

        // 3. Render history from static file (history-data.js)
        renderHistory(HISTORY_DATA);

    } catch (err) {
        console.error('Error loading data:', err);
        document.querySelector('main').innerHTML = `
            <div style="text-align:center; padding:3rem;">
                <h2>Unable to load data</h2>
                <p style="color:var(--text-muted); margin-top:1rem;">
                    Error: ${err.message}
                </p>
            </div>
        `;
    }
}

loadData();
updateModelDesc();
renderExplainer();
