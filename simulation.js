// NCAA Tournament Monte Carlo Simulation Engine
// Uses RPI-based logistic win probability model

const ROUND_POINTS = [5, 10, 15, 20, 25, 30]; // R64, R32, S16, E8, F4, NCG
const ROUND_NAMES = ['R64', 'R32', 'S16', 'E8', 'F4', 'NCG'];

// Logistic win probability: P(A beats B) = 1 / (1 + 10^((rpiB - rpiA) * k))
function winProbability(rpiA, rpiB, k = 7) {
    if (rpiA === null || rpiB === null) return 0.5;
    return 1 / (1 + Math.pow(10, (rpiB - rpiA) * k));
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
function simGame(teamA, teamB, k, forcedWinner) {
    if (forcedWinner) {
        if (teamA.team === forcedWinner) return teamA;
        if (teamB.team === forcedWinner) return teamB;
    }
    const rpiA = teamA.rpi !== null ? teamA.rpi : 0.5;
    const rpiB = teamB.rpi !== null ? teamB.rpi : 0.5;
    const pA = winProbability(rpiA, rpiB, k);
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
function playGame(teamA, teamB, roundIndex, k, forcedWinner, useKnown) {
    if (useKnown) {
        const known = knownResult(teamA, teamB, roundIndex);
        if (known) {
            known.roundWins = (known.roundWins || 0) + 1;
            return known;
        }
    }
    const winner = simGame(teamA, teamB, k, forcedWinner);
    winner.roundWins = (winner.roundWins || 0) + 1;
    return winner;
}

// Simulate a single region through Elite 8
// mode: 'pre' = simulate everything from scratch
//       'current' = use known results wherever available
//       1,2,3,4 = use known results through that many rounds
function simRegion(regionTeams, k, forcedWinner, mode) {
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
        r32.push(playGame(a, b, 0, k, forcedWinner, shouldUseKnown(0)));
    }

    // R32
    let s16 = [];
    for (let i = 0; i < r32.length; i += 2) {
        s16.push(playGame(r32[i], r32[i + 1], 1, k, forcedWinner, shouldUseKnown(1)));
    }

    // S16
    let e8 = [];
    for (let i = 0; i < s16.length; i += 2) {
        e8.push(playGame(s16[i], s16[i + 1], 2, k, forcedWinner, shouldUseKnown(2)));
    }

    // E8
    const regionWinner = playGame(e8[0], e8[1], 3, k, forcedWinner, shouldUseKnown(3));
    return regionWinner;
}

// Simulate entire tournament
function simulateTournament(auctionData, k, forcedWinner, mode) {
    const teamsCopy = auctionData.map(t => ({...t, roundWins: 0}));
    const regionsCopy = buildBracket(teamsCopy);
    const regionNames = Object.keys(regionsCopy);

    const f4 = [];
    for (const rName of regionNames) {
        f4.push(simRegion(regionsCopy[rName], k, forcedWinner, mode));
    }

    const shouldUseF4 = (mode === 'current' || (typeof mode === 'number' && mode >= 5));
    const shouldUseNCG = (mode === 'current' || (typeof mode === 'number' && mode >= 6));

    // Final Four: standard NCAA cross-region pairings
    const semi1 = playGame(f4[0], f4[3], 4, k, forcedWinner, shouldUseF4);
    const semi2 = playGame(f4[1], f4[2], 4, k, forcedWinner, shouldUseF4);

    // Championship
    const champion = playGame(semi1, semi2, 5, k, forcedWinner, shouldUseNCG);

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
function runMonteCarlo(auctionData, numSims, k, onProgress, forcedWinner, mode) {
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
                const result = simulateTournament(auctionData, k, forcedWinner, mode || 'pre');

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
async function runSimSuite(auctionData, numSims, k, mode, forcedWinners, onProgress) {
    const results = {};
    const totalScenarios = 1 + forcedWinners.length;
    let scenariosDone = 0;

    // Normal (no forced winner)
    results['Normal'] = await runMonteCarlo(auctionData, numSims, k, (pct) => {
        if (onProgress) onProgress((scenariosDone + pct) / totalScenarios);
    }, null, mode);
    scenariosDone++;

    // Each forced winner
    for (const fw of forcedWinners) {
        results[fw] = await runMonteCarlo(auctionData, numSims, k, (pct) => {
            if (onProgress) onProgress((scenariosDone + pct) / totalScenarios);
        }, fw, mode);
        scenariosDone++;
    }

    return results;
}
