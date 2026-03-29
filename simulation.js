// NCAA Tournament Monte Carlo Simulation Engine
// Supports RPI-based and Seed-based win probability models

const ROUND_POINTS = [5, 10, 15, 20, 25, 30]; // R64, R32, S16, E8, F4, NCG
const ROUND_NAMES = ['R64', 'R32', 'S16', 'E8', 'F4', 'NCG'];

// ─── RPI Model ──────────────────────────────────────────
// Logistic win probability: P(A beats B) = 1 / (1 + 10^((rpiB - rpiA) * k))
function winProbability(rpiA, rpiB, k = 7) {
    if (rpiA === null || rpiB === null) return 0.5;
    return 1 / (1 + Math.pow(10, (rpiB - rpiA) * k));
}

// ─── Seed Model ─────────────────────────────────────────
// Historical seed matchup win rates (1985-2024, ~40 years of data)
const SEED_WIN_RATES = {
    '1v16': 0.993, '1v8': 0.788, '1v9': 0.862, '1v5': 0.648, '1v12': 0.750,
    '1v4': 0.566, '1v13': 0.850, '1v6': 0.600, '1v11': 0.652, '1v3': 0.533,
    '1v14': 0.867, '1v7': 0.600, '1v10': 0.636, '1v2': 0.508,
    '2v15': 0.946, '2v7': 0.631, '2v10': 0.700, '2v3': 0.508, '2v14': 0.867,
    '2v6': 0.564, '2v11': 0.615, '2v1': 0.492,
    '3v14': 0.851, '3v6': 0.530, '3v11': 0.596, '3v2': 0.492, '3v7': 0.571,
    '3v10': 0.588, '3v1': 0.467,
    '4v13': 0.789, '4v5': 0.541, '4v12': 0.625, '4v1': 0.434, '4v8': 0.500,
    '4v9': 0.556, '4v6': 0.500,
    '5v12': 0.649, '5v4': 0.459, '5v13': 0.625, '5v1': 0.352, '5v8': 0.444,
    '5v9': 0.500,
    '6v11': 0.620, '6v3': 0.470, '6v14': 0.600, '6v7': 0.500, '6v10': 0.538,
    '6v2': 0.436, '6v1': 0.400,
    '7v10': 0.609, '7v2': 0.369, '7v15': 0.500, '7v3': 0.429, '7v6': 0.500,
    '8v9': 0.517, '8v1': 0.212, '8v4': 0.500, '8v5': 0.556,
    '9v8': 0.483, '9v1': 0.138, '9v4': 0.444, '9v5': 0.500,
    '10v7': 0.391, '10v2': 0.300, '10v15': 0.500, '10v3': 0.412, '10v6': 0.462,
    '11v6': 0.380, '11v3': 0.404, '11v14': 0.500, '11v2': 0.385, '11v7': 0.500,
    '12v5': 0.351, '12v4': 0.375, '12v13': 0.500, '12v1': 0.250,
    '13v4': 0.211, '13v5': 0.375, '13v12': 0.500,
    '14v3': 0.149, '14v6': 0.400, '14v11': 0.500, '14v2': 0.133,
    '15v2': 0.054, '15v7': 0.500, '15v10': 0.500,
    '16v1': 0.007
};

function winProbSeed(seedA, seedB) {
    const key = `${seedA}v${seedB}`;
    if (SEED_WIN_RATES[key] !== undefined) return SEED_WIN_RATES[key];
    const revKey = `${seedB}v${seedA}`;
    if (SEED_WIN_RATES[revKey] !== undefined) return 1 - SEED_WIN_RATES[revKey];
    // Fallback: derive from seed difference
    return 1 / (1 + Math.pow(10, (seedA - seedB) * 0.05));
}

// Standard first-round matchups by seed
const SEED_MATCHUPS = [
    [1, 16], [8, 9], [5, 12], [4, 13],
    [6, 11], [3, 14], [7, 10], [2, 15]
];

function buildBracket(auctionData) {
    const regions = {};
    for (const team of auctionData) {
        if (!regions[team.region]) regions[team.region] = {};
        regions[team.region][team.seed] = team;
    }
    return regions;
}

// Simulate a single game (forcedWinner = team name that always wins, or null)
// model: 'rpi' or 'seed'
function simGame(teamA, teamB, k, forcedWinner, model) {
    if (forcedWinner) {
        if (teamA.team === forcedWinner) return teamA;
        if (teamB.team === forcedWinner) return teamB;
    }
    let pA;
    if (model === 'seed') {
        pA = winProbSeed(teamA.seed, teamB.seed);
    } else {
        const rpiA = teamA.rpi !== null ? teamA.rpi : 0.5;
        const rpiB = teamB.rpi !== null ? teamB.rpi : 0.5;
        pA = winProbability(rpiA, rpiB, k);
    }
    return Math.random() < pA ? teamA : teamB;
}

// Check if we have a known result for a game at a given round
function knownResult(teamA, teamB, roundIndex) {
    const resA = teamA.roundResults ? teamA.roundResults[roundIndex] : null;
    const resB = teamB.roundResults ? teamB.roundResults[roundIndex] : null;
    // Both must have non-null results to count as known
    if (resA !== null && resA !== undefined && resB !== null && resB !== undefined) {
        if (resA > 0) return teamA;
        if (resB > 0) return teamB;
    }
    return null;
}

// Play a game: use known result if applicable, otherwise simulate
function playGame(teamA, teamB, roundIndex, k, forcedWinner, useKnown, model) {
    if (useKnown) {
        const known = knownResult(teamA, teamB, roundIndex);
        if (known) {
            known.roundWins = (known.roundWins || 0) + 1;
            return known;
        }
    }
    const winner = simGame(teamA, teamB, k, forcedWinner, model);
    winner.roundWins = (winner.roundWins || 0) + 1;
    return winner;
}

// Simulate a single region through Elite 8
// mode: 'pre' = simulate everything from scratch
//       'current' = use known results wherever available
//       1,2,3,4 = use known results through that many rounds
function simRegion(regionTeams, k, forcedWinner, mode, model) {
    const shouldUseKnown = (round) => {
        if (mode === 'pre') return false;
        if (mode === 'current') return true;
        return round < mode; // e.g. mode=1 means use known for round 0 (R64)
    };

    // R64
    let r32 = [];
    for (const [seedA, seedB] of SEED_MATCHUPS) {
        const a = regionTeams[seedA];
        const b = regionTeams[seedB];
        if (!a || !b) { r32.push(a || b); continue; }
        r32.push(playGame(a, b, 0, k, forcedWinner, shouldUseKnown(0), model));
    }

    // R32
    let s16 = [];
    for (let i = 0; i < r32.length; i += 2) {
        s16.push(playGame(r32[i], r32[i + 1], 1, k, forcedWinner, shouldUseKnown(1), model));
    }

    // S16
    let e8 = [];
    for (let i = 0; i < s16.length; i += 2) {
        e8.push(playGame(s16[i], s16[i + 1], 2, k, forcedWinner, shouldUseKnown(2), model));
    }

    // E8
    const regionWinner = playGame(e8[0], e8[1], 3, k, forcedWinner, shouldUseKnown(3), model);
    return regionWinner;
}

// Simulate entire tournament
function simulateTournament(auctionData, k, forcedWinner, mode, model) {
    const teamsCopy = auctionData.map(t => ({...t, roundWins: 0}));
    const regionsCopy = buildBracket(teamsCopy);
    const regionNames = Object.keys(regionsCopy);

    const f4 = [];
    for (const rName of regionNames) {
        f4.push(simRegion(regionsCopy[rName], k, forcedWinner, mode, model));
    }

    const shouldUseF4 = (mode === 'current' || (typeof mode === 'number' && mode >= 5));
    const shouldUseNCG = (mode === 'current' || (typeof mode === 'number' && mode >= 6));

    // Final Four: 2026 NCAA cross-region pairings (E vs S, W vs MW)
    // Regions: W=0, MW=1, E=2, S=3
    const semi1 = playGame(f4[2], f4[3], 4, k, forcedWinner, shouldUseF4, model);
    const semi2 = playGame(f4[0], f4[1], 4, k, forcedWinner, shouldUseF4, model);

    // Championship
    const champion = playGame(semi1, semi2, 5, k, forcedWinner, shouldUseNCG, model);

    const results = {};
    for (const t of teamsCopy) {
        const wins = t.roundWins || 0;
        let pts = 0;
        for (let i = 0; i < wins && i < ROUND_POINTS.length; i++) {
            pts += ROUND_POINTS[i];
        }
        results[t.team] = {
            points: pts,
            roundWins: wins,
            isChampion: t.team === champion.team,
            isFinalFour: f4.some(x => x.team === t.team)
        };
    }
    return results;
}

// Run Monte Carlo simulation
function runMonteCarlo(auctionData, numSims, k, onProgress, forcedWinner, mode, model) {
    const teamStats = {};
    const playerWins = { Jud: 0, Bob: 0, Fletch: 0 };
    const playerPoints = { Jud: 0, Bob: 0, Fletch: 0 };
    let ties = 0;

    for (const t of auctionData) {
        teamStats[t.team] = {
            champCount: 0, f4Count: 0, totalPoints: 0,
            owner: t.owner, seed: t.seed, rpi: t.rpi
        };
    }

    const batchSize = 100;
    let completed = 0;

    return new Promise((resolve) => {
        function runBatch() {
            const end = Math.min(completed + batchSize, numSims);
            for (let i = completed; i < end; i++) {
                const result = simulateTournament(auctionData, k, forcedWinner, mode || 'pre', model || 'rpi');

                const simPlayerPts = { Jud: 0, Bob: 0, Fletch: 0 };
                for (const [team, data] of Object.entries(result)) {
                    const teamInfo = auctionData.find(t => t.team === team);
                    if (!teamInfo) continue;
                    const owner = teamInfo.owner;

                    // Only attribute to known players
                    if (simPlayerPts[owner] !== undefined) {
                        simPlayerPts[owner] += data.points;
                    }

                    teamStats[team].totalPoints += data.points;
                    if (data.isChampion) teamStats[team].champCount++;
                    if (data.isFinalFour) teamStats[team].f4Count++;
                }

                const maxPts = Math.max(simPlayerPts.Jud, simPlayerPts.Bob, simPlayerPts.Fletch);
                const winners = Object.entries(simPlayerPts).filter(([_, p]) => p === maxPts);
                if (winners.length === 1) {
                    playerWins[winners[0][0]]++;
                } else {
                    ties++;
                }
                for (const [player, pts] of Object.entries(simPlayerPts)) {
                    playerPoints[player] += pts;
                }
            }

            completed = end;
            if (onProgress) onProgress(completed / numSims);

            if (completed < numSims) {
                setTimeout(runBatch, 0);
            } else {
                for (const team of Object.keys(teamStats)) {
                    teamStats[team].champPct = teamStats[team].champCount / numSims;
                    teamStats[team].f4Pct = teamStats[team].f4Count / numSims;
                    teamStats[team].avgPoints = teamStats[team].totalPoints / numSims;
                }
                for (const player of Object.keys(playerPoints)) {
                    playerPoints[player] /= numSims;
                }
                resolve({
                    playerWinPct: {
                        Jud: playerWins.Jud / numSims,
                        Bob: playerWins.Bob / numSims,
                        Fletch: playerWins.Fletch / numSims
                    },
                    playerExpectedPoints: playerPoints,
                    teamStats,
                    ties: ties / numSims,
                    numSims
                });
            }
        }
        runBatch();
    });
}

// Run the full suite: Normal + each forced winner scenario
async function runSimSuite(auctionData, numSims, k, mode, forcedWinners, onProgress, model) {
    const results = {};
    const totalScenarios = 1 + forcedWinners.length;
    let scenariosDone = 0;

    // Normal (no forced winner)
    results['Normal'] = await runMonteCarlo(auctionData, numSims, k, (pct) => {
        if (onProgress) onProgress((scenariosDone + pct) / totalScenarios);
    }, null, mode, model);
    scenariosDone++;

    // Each forced winner
    for (const fw of forcedWinners) {
        results[fw] = await runMonteCarlo(auctionData, numSims, k, (pct) => {
            if (onProgress) onProgress((scenariosDone + pct) / totalScenarios);
        }, fw, mode, model);
        scenariosDone++;
    }

    return results;
}
