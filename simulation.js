// NCAA Tournament Monte Carlo Simulation Engine
// Uses RPI-based logistic win probability model

const ROUND_POINTS = [5, 10, 15, 20, 25, 30]; // R64, R32, S16, E8, F4, NCG

// Logistic win probability: P(A beats B) = 1 / (1 + 10^((rpiB - rpiA) * k))
// k controls sensitivity: higher k = smaller RPI gaps matter more
function winProbability(rpiA, rpiB, k = 7) {
    if (rpiA === null || rpiB === null) {
        // Fallback: 50/50 if no RPI data
        return 0.5;
    }
    return 1 / (1 + Math.pow(10, (rpiB - rpiA) * k));
}

// The NCAA bracket structure: 4 regions, each with seeds 1-16
// Standard bracket matchups in each region (seed pairings):
// R64: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
// R32: (1/16)v(8/9), (5/12)v(4/13), (6/11)v(3/14), (7/10)v(2/15)
// S16: top half v bottom half of each region
// E8: top quarter v bottom quarter
// F4 and NCG: cross-region

// Build bracket from auction data
function buildBracket(auctionData) {
    // Group teams by region
    const regions = {};
    for (const team of auctionData) {
        if (!regions[team.region]) regions[team.region] = {};
        regions[team.region][team.seed] = team;
    }
    return regions;
}

// Standard first-round matchups by seed
const SEED_MATCHUPS = [
    [1, 16], [8, 9], [5, 12], [4, 13],
    [6, 11], [3, 14], [7, 10], [2, 15]
];

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

// Simulate a single region through Elite 8
function simRegion(regionTeams, k, forcedWinner) {
    // Round of 64
    let r32 = [];
    for (const [seedA, seedB] of SEED_MATCHUPS) {
        const a = regionTeams[seedA];
        const b = regionTeams[seedB];
        if (!a || !b) {
            r32.push(a || b);
            continue;
        }
        const winner = simGame(a, b, k, forcedWinner);
        winner.roundWins = (winner.roundWins || 0) + 1;
        r32.push(winner);
    }

    // Round of 32
    let s16 = [];
    for (let i = 0; i < r32.length; i += 2) {
        const winner = simGame(r32[i], r32[i + 1], k, forcedWinner);
        winner.roundWins = (winner.roundWins || 0) + 1;
        s16.push(winner);
    }

    // Sweet 16
    let e8 = [];
    for (let i = 0; i < s16.length; i += 2) {
        const winner = simGame(s16[i], s16[i + 1], k, forcedWinner);
        winner.roundWins = (winner.roundWins || 0) + 1;
        e8.push(winner);
    }

    // Elite 8
    const regionWinner = simGame(e8[0], e8[1], k, forcedWinner);
    regionWinner.roundWins = (regionWinner.roundWins || 0) + 1;
    return regionWinner;
}

// Simulate entire tournament
function simulateTournament(auctionData, k, forcedWinner) {
    const regions = buildBracket(auctionData);
    const regionNames = Object.keys(regions);

    // Reset round wins for this sim
    const teamsCopy = auctionData.map(t => ({...t, simPoints: 0}));
    const regionsCopy = buildBracket(teamsCopy);

    // Simulate each region
    const f4 = [];
    for (const rName of regionNames) {
        f4.push(simRegion(regionsCopy[rName], k, forcedWinner));
    }

    // Final Four pairings: standard NCAA bracket
    const semi1 = simGame(f4[0], f4[3], k, forcedWinner);
    semi1.roundWins = (semi1.roundWins || 0) + 1;
    const semi2 = simGame(f4[1], f4[2], k, forcedWinner);
    semi2.roundWins = (semi2.roundWins || 0) + 1;

    // Championship
    const champion = simGame(semi1, semi2, k, forcedWinner);
    champion.roundWins = (champion.roundWins || 0) + 1;

    // Calculate points for all teams
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
function runMonteCarlo(auctionData, numSims, k, onProgress, forcedWinner) {
    const teamStats = {};
    const playerWins = { Jud: 0, Bob: 0, Fletch: 0 };
    const playerPoints = { Jud: 0, Bob: 0, Fletch: 0 };
    let ties = 0;

    // Initialize team stats
    for (const t of auctionData) {
        teamStats[t.team] = {
            champCount: 0,
            f4Count: 0,
            totalPoints: 0,
            owner: t.owner,
            seed: t.seed,
            rpi: t.rpi
        };
    }

    const batchSize = 100;
    let completed = 0;

    return new Promise((resolve) => {
        function runBatch() {
            const end = Math.min(completed + batchSize, numSims);
            for (let i = completed; i < end; i++) {
                const result = simulateTournament(auctionData, k, forcedWinner);

                // Tally player points for this sim
                // The sim re-simulates all rounds, so data.points is the full
                // tournament points for that team. Sum always = 600.
                const simPlayerPts = { Jud: 0, Bob: 0, Fletch: 0 };
                for (const [team, data] of Object.entries(result)) {
                    const teamInfo = auctionData.find(t => t.team === team);
                    if (!teamInfo) continue;
                    const owner = teamInfo.owner;

                    simPlayerPts[owner] = (simPlayerPts[owner] || 0) + data.points;

                    teamStats[team].totalPoints += data.points;
                    if (data.isChampion) teamStats[team].champCount++;
                    if (data.isFinalFour) teamStats[team].f4Count++;
                }

                // Determine winner
                const maxPts = Math.max(...Object.values(simPlayerPts));
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
                // Compute averages
                for (const team of Object.keys(teamStats)) {
                    teamStats[team].champPct = teamStats[team].champCount / numSims;
                    teamStats[team].f4Pct = teamStats[team].f4Count / numSims;
                    teamStats[team].avgPoints = teamStats[team].totalPoints / numSims;
                }
                for (const player of Object.keys(playerPoints)) {
                    playerPoints[player] /= numSims;
                }
                const totalNonTie = numSims - ties;
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
