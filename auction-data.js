// 2026 NCAA Auction Game - Static Auction Data
// Teams, owners, bids - pulled from Google Sheets (one-time snapshot)
// Round results come from results.json on GitHub, NOT from this file

const AUCTION_DATA = [
    // 1-seeds
    {opener:"Jud",region:"W",seed:1,team:"Arizona",owner:"Fletch",price:53,judBid:0,bobBid:0,fletchBid:53},
    {opener:"Bob",region:"MW",seed:1,team:"Michigan",owner:"Jud",price:48,judBid:48,bobBid:0,fletchBid:0},
    {opener:"Fletch",region:"E",seed:1,team:"Duke",owner:"Bob",price:52,judBid:0,bobBid:52,fletchBid:0},
    {opener:"Jud",region:"S",seed:1,team:"Florida",owner:"Jud",price:34,judBid:34,bobBid:0,fletchBid:0},
    // 2-seeds
    {opener:"Bob",region:"W",seed:2,team:"Purdue",owner:"Fletch",price:26,judBid:0,bobBid:0,fletchBid:26},
    {opener:"Fletch",region:"MW",seed:2,team:"Iowa St.",owner:"Jud",price:27,judBid:27,bobBid:0,fletchBid:0},
    {opener:"Jud",region:"E",seed:2,team:"UConn",owner:"Bob",price:31,judBid:0,bobBid:31,fletchBid:0},
    {opener:"Bob",region:"S",seed:2,team:"Houston",owner:"Fletch",price:38,judBid:0,bobBid:0,fletchBid:38},
    // 3-seeds
    {opener:"Fletch",region:"W",seed:3,team:"Gonzaga",owner:"Bob",price:18,judBid:0,bobBid:18,fletchBid:0},
    {opener:"Jud",region:"MW",seed:3,team:"Virginia",owner:"Bob",price:18,judBid:0,bobBid:18,fletchBid:0},
    {opener:"Bob",region:"E",seed:3,team:"Michigan St.",owner:"Jud",price:22,judBid:22,bobBid:0,fletchBid:0},
    {opener:"Fletch",region:"S",seed:3,team:"Illinois",owner:"Bob",price:14,judBid:0,bobBid:14,fletchBid:0},
    // 4-seeds
    {opener:"Jud",region:"W",seed:4,team:"Arkansas",owner:"Jud",price:14,judBid:14,bobBid:0,fletchBid:0},
    {opener:"Bob",region:"MW",seed:4,team:"Alabama",owner:"Bob",price:13,judBid:0,bobBid:13,fletchBid:0},
    {opener:"Fletch",region:"E",seed:4,team:"Kansas",owner:"Fletch",price:10,judBid:0,bobBid:0,fletchBid:10},
    {opener:"Jud",region:"S",seed:4,team:"Nebraska",owner:"Bob",price:9,judBid:0,bobBid:9,fletchBid:0},
    // 5-seeds
    {opener:"Bob",region:"W",seed:5,team:"Wisconsin",owner:"Bob",price:7,judBid:0,bobBid:7,fletchBid:0},
    {opener:"Fletch",region:"MW",seed:5,team:"Texas Tech",owner:"Jud",price:7,judBid:7,bobBid:0,fletchBid:0},
    {opener:"Jud",region:"E",seed:5,team:"St. John's",owner:"Bob",price:9,judBid:0,bobBid:9,fletchBid:0},
    {opener:"Bob",region:"S",seed:5,team:"Vanderbilt",owner:"Fletch",price:7,judBid:0,bobBid:0,fletchBid:7},
    // 6-seeds
    {opener:"Fletch",region:"W",seed:6,team:"BYU",owner:"Fletch",price:8,judBid:0,bobBid:0,fletchBid:8},
    {opener:"Jud",region:"MW",seed:6,team:"Tennessee",owner:"Jud",price:10,judBid:10,bobBid:0,fletchBid:0},
    {opener:"Bob",region:"E",seed:6,team:"Louisville",owner:"Fletch",price:8,judBid:0,bobBid:0,fletchBid:8},
    {opener:"Fletch",region:"S",seed:6,team:"North Carolina",owner:"Jud",price:10,judBid:10,bobBid:0,fletchBid:0},
    // 7-seeds
    {opener:"Jud",region:"W",seed:7,team:"Miami (FL)",owner:"Bob",price:4,judBid:0,bobBid:4,fletchBid:0},
    {opener:"Bob",region:"MW",seed:7,team:"Kentucky",owner:"Fletch",price:5,judBid:0,bobBid:0,fletchBid:5},
    {opener:"Fletch",region:"E",seed:7,team:"UCLA",owner:"Bob",price:5,judBid:0,bobBid:5,fletchBid:0},
    {opener:"Jud",region:"S",seed:7,team:"Saint Mary's",owner:"Bob",price:3,judBid:0,bobBid:3,fletchBid:0},
    // 8-seeds
    {opener:"Bob",region:"W",seed:8,team:"Villanova",owner:"Jud",price:3,judBid:3,bobBid:0,fletchBid:0},
    {opener:"Fletch",region:"MW",seed:8,team:"Georgia",owner:"Bob",price:3,judBid:0,bobBid:3,fletchBid:0},
    {opener:"Jud",region:"E",seed:8,team:"Ohio St.",owner:"Jud",price:4,judBid:4,bobBid:0,fletchBid:0},
    {opener:"Bob",region:"S",seed:8,team:"Clemson",owner:"Fletch",price:3,judBid:0,bobBid:0,fletchBid:3},
    // 9-seeds
    {opener:"Fletch",region:"W",seed:9,team:"Utah St.",owner:"Fletch",price:4,judBid:0,bobBid:0,fletchBid:4},
    {opener:"Jud",region:"MW",seed:9,team:"Saint Louis",owner:"Jud",price:4,judBid:4,bobBid:0,fletchBid:0},
    {opener:"Bob",region:"E",seed:9,team:"TCU",owner:"Fletch",price:2,judBid:0,bobBid:0,fletchBid:2},
    {opener:"Fletch",region:"S",seed:9,team:"Iowa",owner:"Jud",price:3,judBid:3,bobBid:0,fletchBid:0},
    // 10-seeds
    {opener:"Jud",region:"W",seed:10,team:"Missouri",owner:"Jud",price:5,judBid:5,bobBid:0,fletchBid:0},
    {opener:"Bob",region:"MW",seed:10,team:"Santa Clara",owner:"Bob",price:3,judBid:0,bobBid:3,fletchBid:0},
    {opener:"Fletch",region:"E",seed:10,team:"UCF",owner:"Jud",price:3,judBid:3,bobBid:0,fletchBid:0},
    {opener:"Jud",region:"S",seed:10,team:"Texas A&M",owner:"Fletch",price:4,judBid:0,bobBid:0,fletchBid:4},
    // 11-seeds
    {opener:"Bob",region:"W",seed:11,team:"NC State / Texas",owner:"Bob",price:3,judBid:0,bobBid:3,fletchBid:0},
    {opener:"Fletch",region:"MW",seed:11,team:"SMU / Miami (Ohio)",owner:"Fletch",price:3,judBid:0,bobBid:0,fletchBid:3},
    {opener:"Jud",region:"E",seed:11,team:"South Florida",owner:"Jud",price:2,judBid:2,bobBid:0,fletchBid:0},
    {opener:"Bob",region:"S",seed:11,team:"VCU",owner:"Fletch",price:3,judBid:0,bobBid:0,fletchBid:3},
    // 12-seeds
    {opener:"Fletch",region:"W",seed:12,team:"High Point",owner:"Bob",price:3,judBid:0,bobBid:3,fletchBid:0},
    {opener:"Jud",region:"MW",seed:12,team:"Akron",owner:"Fletch",price:3,judBid:0,bobBid:0,fletchBid:3},
    {opener:"Bob",region:"E",seed:12,team:"Northern Iowa",owner:"Fletch",price:1,judBid:0,bobBid:0,fletchBid:1},
    {opener:"Fletch",region:"S",seed:12,team:"McNeese",owner:"Bob",price:2,judBid:0,bobBid:2,fletchBid:0},
    // 13-seeds
    {opener:"Jud",region:"W",seed:13,team:"Hawaii",owner:"Jud",price:1,judBid:1,bobBid:0,fletchBid:0},
    {opener:"Bob",region:"MW",seed:13,team:"Hofstra",owner:"Bob",price:1,judBid:0,bobBid:1,fletchBid:0},
    {opener:"Fletch",region:"E",seed:13,team:"Cal Baptist",owner:"Bob",price:1,judBid:0,bobBid:1,fletchBid:0},
    {opener:"Jud",region:"S",seed:13,team:"Troy",owner:null,price:0,judBid:0,bobBid:0,fletchBid:0},
    // 14-seeds
    {opener:"Bob",region:"W",seed:14,team:"Kennesaw St.",owner:"Jud",price:1,judBid:1,bobBid:0,fletchBid:0},
    {opener:"Fletch",region:"MW",seed:14,team:"Wright St.",owner:null,price:0,judBid:0,bobBid:0,fletchBid:0},
    {opener:"Jud",region:"E",seed:14,team:"North Dakota St.",owner:"Jud",price:1,judBid:1,bobBid:0,fletchBid:0},
    {opener:"Bob",region:"S",seed:14,team:"Penn",owner:"Bob",price:1,judBid:0,bobBid:1,fletchBid:0},
    // 15-seeds
    {opener:"Fletch",region:"W",seed:15,team:"Queens (N.C.)",owner:null,price:0,judBid:0,bobBid:0,fletchBid:0},
    {opener:"Jud",region:"MW",seed:15,team:"Tennessee St.",owner:"Jud",price:1,judBid:1,bobBid:0,fletchBid:0},
    {opener:"Bob",region:"E",seed:15,team:"Furman",owner:null,price:0,judBid:0,bobBid:0,fletchBid:0},
    {opener:"Fletch",region:"S",seed:15,team:"Idaho",owner:null,price:0,judBid:0,bobBid:0,fletchBid:0},
    // 16-seeds
    {opener:"Jud",region:"W",seed:16,team:"Long Island",owner:null,price:0,judBid:0,bobBid:0,fletchBid:0},
    {opener:"Bob",region:"MW",seed:16,team:"Howard / UMBC",owner:null,price:0,judBid:0,bobBid:0,fletchBid:0},
    {opener:"Fletch",region:"E",seed:16,team:"Siena",owner:null,price:0,judBid:0,bobBid:0,fletchBid:0},
    {opener:"Jud",region:"S",seed:16,team:"Lehigh / Prairie View A&M",owner:null,price:0,judBid:0,bobBid:0,fletchBid:0}
];
