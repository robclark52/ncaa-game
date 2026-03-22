// NCAA Auction Game - Historical Results (static data)
// Pulled from Google Sheets (one-time snapshot)

const HISTORY_DATA = {
    summary: {
        Jud:    { wins: 5, second: 6, third: 5, points: 2580 },
        Bob:    { wins: 5, second: 5, third: 5, points: 2890 },
        Fletch: { wins: 7, second: 4, third: 5, points: 3240 }
    },
    years: [
        { year: 2002, jud: null, bob: null, fletch: null, winner: 'Jud', note: 'Jud won' },
        { year: 2003, jud: null, bob: null, fletch: null, winner: null, note: 'No data' },
        { year: 2004, jud: null, bob: null, fletch: null, winner: null, note: 'No data' },
        { year: 2005, jud: null, bob: null, fletch: null, winner: null, note: 'No data' },
        { year: 2006, jud: null, bob: null, fletch: null, winner: null, note: 'No data' },
        { year: 2007, jud: null, bob: null, fletch: null, winner: null, note: 'No data' },
        { year: 2008, jud: null, bob: null, fletch: null, winner: null, note: 'No data' },
        { year: 2009, jud: null, bob: null, fletch: null, winner: 'Fletch', note: 'Fletch won' },
        { year: 2010, jud: 230, bob: 220, fletch: 145, winner: 'Jud' },
        { year: 2011, jud: 115, bob: 315, fletch: 170, winner: 'Bob' },
        { year: 2012, jud: 250, bob: 235, fletch: 110, winner: 'Jud' },
        { year: 2013, jud: 65,  bob: 310, fletch: 225, winner: 'Bob' },
        { year: 2014, jud: 220, bob: 145, fletch: 230, winner: 'Fletch' },
        { year: 2015, jud: 320, bob: 145, fletch: 130, winner: 'Jud' },
        { year: 2016, jud: 180, bob: 95,  fletch: 315, winner: 'Fletch' },
        { year: 2017, jud: 125, bob: 195, fletch: 280, winner: 'Fletch' },
        { year: 2018, jud: 175, bob: 50,  fletch: 370, winner: 'Fletch' },
        { year: 2019, jud: 115, bob: 165, fletch: 120, winner: 'Bob' },
        { year: 2020, jud: null, bob: null, fletch: null, winner: null, note: 'No data \u2014 COVID cancelled tournament' },
        { year: 2021, jud: 170, bob: 270, fletch: 145, winner: 'Bob' },
        { year: 2022, jud: 200, bob: 255, fletch: 115, winner: 'Bob' },
        { year: 2023, jud: 70,  bob: 185, fletch: 340, winner: 'Fletch' },
        { year: 2024, jud: 125, bob: 120, fletch: 350, winner: 'Fletch' },
        { year: 2025, jud: 220, bob: 185, fletch: 195, winner: 'Jud' }
    ]
};
