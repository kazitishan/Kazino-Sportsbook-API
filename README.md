# Kazino Sportsbook API

An API that provides live match data, betting odds, and match results for soccer matches.

## Overview

This API delivers comprehensive soccer match information including:
- **Live matches** with current scores and match minutes
- **Upcoming matches** with scheduled times and pre-match odds
- **Finished matches** with final scores and betting results
- **Match filtering** by status, date, competition, and region

## Base Endpoint

All endpoints are relative to: `http://localhost:8080`

## API Endpoints

### 1. Get Today's Matches


Returns all matches scheduled for today.

```bash
GET /matches
```

**Response Structure:**
```json
[
  {
    "region": "Europe",
    "competition": "Champions League",
    "matches": [
      {
        "status": "Not Played Yet",
        "homeTeam": "Ath Bilbao",
        "awayTeam": "Arsenal",
        "dateTime": "09-16-2025 12:45 EST",
        "finished": false,
        "live": false,
        "odds": [
          "5.01",
          "3.58",
          "1.77"
        ],
        "score": null,
        "minute": null,
        "result": null,
        "matchLink": "/football/europe/champions-league/ath-bilbao-arsenal/bexfCspg/"
      }
    ]
  }
]
```

### 2. Filter by Match Status

#### Live Matches
Get all matches currently being played.

```bash
GET /matches?live=true
```

**Example Response:**
```json
[
  {
    "region": "Estonia",
    "competition": "Meistriliiga",
    "matches": [
      {
        "status": "Being played right now",
        "homeTeam": "Tammeka",
        "awayTeam": "Parnu JK Vaprus",
        "dateTime": null,
        "finished": false,
        "live": true,
        "odds": [
          "3.38",
          "3.83",
          "1.85"
        ],
        "score": "0:1",
        "minute": "4'",
        "result": null,
        "matchLink": "/football/estonia/meistriliiga/tammeka-tartu-parnu-jk-vaprus/rgeRiEkl/"
      }
    ]
  }
]
```

#### Non-Live Matches
Get upcoming and finished matches (excludes live games).

```bash
GET /matches?live=false
```

#### Finished Matches
Get all completed matches with final results.

```bash
GET /matches?finished=true
```

**Example Response:**
```json
[
  {
    "region": "Asia",
    "competition": "AFC Champions League",
    "matches": [
      {
        "status": "Finished",
        "homeTeam": "Melbourne City",
        "awayTeam": "Sanfrecce Hiroshima",
        "dateTime": null,
        "finished": true,
        "live": false,
        "odds": [
          "3.68",
          "3.27",
          "1.98"
        ],
        "score": "0:2",
        "minute": null,
        "result": "AWAY",
        "matchLink": "/football/asia/afc-champions-league/melbourne-city-sanfrecce-hiroshima/fLORUQen/"
      }
    ]
  }
]
```

#### Non-Finished Matches
Get upcoming and live matches (excludes finished games).

```bash
GET /matches?finished=false
```


### 3. Filter by Date

Get all matches for a specific date using MM-DD-YYYY format.

```bash
GET /matches?date=08-30-2025
```

### 4. Filter by Region/Competition

#### By Region
Get all matches from a specific region (e.g., England, Spain, Germany).

```bash
GET /matches/england
```

#### By Competition
Get all matches from a specific competition within a region.

```bash
GET /matches/england/premier-league
```

## Response Field Descriptions

### Match Status Types
- `"Not Played Yet"` - Match is scheduled but hasn't started
- `"Being played right now"` - Match is currently in progress
- `"Finished"` - Match completed in normal time
- `"Finished after extra time"` - Match completed after extra time
- `"Finished after penalties"` - Match completed after penalty shootout

### Odds Array
The `odds` array contains three values in order:
1. **Home team win** (first element)
2. **Draw** (second element)  
3. **Away team win** (third element)

### Result Values (for finished matches)
- `"HOME"` - Home team won
- `"DRAW"` - Match ended in a draw
- `"AWAY"` - Away team won

### Match Fields
- `dateTime` - Scheduled match time in MM-DD-YYYY HH:MM EST format (null for live/finished matches)
- `live` - Boolean indicating if the match is currently being played
- `finished` - Boolean indicating if the match has completed
- `score` - Current or final score (e.g., "2:1", "0:0") - null for upcoming matches
- `minute` - Current match minute for live matches (e.g., "67'", "23'") - null for non-live matches
- `result` - Betting result for finished matches ("HOME", "DRAW", "AWAY") - null for non-finished matches

## Data Refresh

The API automatically refreshes match data every 20 seconds to ensure up-to-date information for live matches, odds, and results.

## TODO

- Transition to a persistent database to ensure data integrity, preserve historical records, and establish unique identifiers for all matches, eliminating dependency on external links.
- Implement an intelligent scraping scheduler that activates only during live match windows, significantly reducing unnecessary requests.