const express = require('express');
const router = express.Router();
const { getCachedMatches, getCachedTodaysMatches } = require('../scraper');
const errors = require('../errors');

// Filters matches by finished status
function filterFinished(competitionsArray, finished) {
    return competitionsArray.map(competition => {
        let filteredMatches;

        if (finished === 'true') {
            filteredMatches = competition.matches.filter(match => match.finished === true);
        } else if (finished === 'false') {
            filteredMatches = competition.matches.filter(match => match.finished === false);
        } else {
            filteredMatches = competition.matches;
        }
        
        return {
            region: competition.region,
            competition: competition.competition,
            matches: filteredMatches
        };
    }).filter(competition => competition.matches.length > 0);
}

// Filters matches by live status
function filterLive(competitionsArray, live) {
    return competitionsArray.map(competition => {
        let filteredMatches;

        if (live === 'true') {
            filteredMatches = competition.matches.filter(match => match.live === true);
        } else if (live === 'false') {
            filteredMatches = competition.matches.filter(match => match.live === false);
        } else {
            filteredMatches = competition.matches;
        }
        
        return {
            region: competition.region,
            competition: competition.competition,
            matches: filteredMatches
        };
    }).filter(competition => competition.matches.length > 0);
}

router.get('/', async (req, res) => {
    try {
        const allMatches = getCachedMatches();
        const todaysMatches = getCachedTodaysMatches();

        if (!allMatches || !todaysMatches) {
            return res.status(errors.CACHE_NOT_READY.status).json(errors.CACHE_NOT_READY.body);
        }

        const dateFilter = req.query.date;
        const finished = req.query.finished;
        const live = req.query.live;

        if (!dateFilter) {
            if (finished !== undefined) {
                return res.json(filterFinished(todaysMatches, finished));
            }
            if (live !== undefined) {
                return res.json(filterLive(todaysMatches, live));
            }
            return res.json(todaysMatches);
        }
        
        // Filter matches by date
        const filteredMatches = allMatches.filter(competition => {
            const filteredMatchesForCompetition = competition.matches.filter(match => {
                if (!match.dateTime || match.dateTime === 'Date not available') {
                    return false;
                }
                
                const dateMatch = match.dateTime.match(/^(\d{2}-\d{2}-\d{4})/);
                if (!dateMatch) {
                    return false;
                }
                
                const matchDate = dateMatch[1];
                return matchDate === dateFilter;
            });
            
            competition.matches = filteredMatchesForCompetition;
            return filteredMatchesForCompetition.length > 0;
        });
        
        res.json(filteredMatches);

    } catch (error) {
        console.error('Error in matches route:', error);
        res.status(500).json({ 
            error: 'Failed to process matches request',
            details: error.message 
        });
    }
});

router.get('/:region', async (req, res) => {
    try {
        const regionName = req.params.region;
        const allMatches = getCachedMatches();
        
        if (!allMatches) {
            return res.status(errors.CACHE_NOT_READY.status).json(errors.CACHE_NOT_READY.body);
        }

        const regionMatches = allMatches.filter(competition => 
            competition.region.toLowerCase() === regionName.toLowerCase()
        );

        if (regionMatches.length === 0) {
            return res.status(errors.REGION_NOT_FOUND.status).json(errors.REGION_NOT_FOUND.body);
        }
        
        res.json(regionMatches);
    } catch (error) {
        console.error(`Error fetching matches for region ${req.params.region}:`, error);
        res.status(500).json({ 
            error: 'Failed to fetch matches by region',
            details: error.message 
        });
    }
});

router.get('/:region/:competition', async (req, res) => {
    try {
        const regionName = req.params.region;
        const competitionName = req.params.competition;
        const allMatches = getCachedMatches();
        const link = req.query.link;
        
        if (!allMatches) {
            return res.status(errors.CACHE_NOT_READY.status).json(errors.CACHE_NOT_READY.body);
        }

        const regionExists = allMatches.some(competition => 
            competition.region.toLowerCase() === regionName.toLowerCase()
        );
        if (!regionExists) { return res.status(errors.REGION_NOT_FOUND.status).json(errors.REGION_NOT_FOUND.body); }

        // Find the competition in the region
        const competitionData = allMatches.find(competition => 
            competition.region.toLowerCase() === regionName.toLowerCase() && 
            competition.competition.toLowerCase() === competitionName.toLowerCase()
        );

        if (!competitionData) {
            return res.status(errors.COMPETITION_NOT_FOUND.status).json(errors.COMPETITION_NOT_FOUND.body);
        }
        
        if (!link) {
            return res.json(competitionData);
        }

        // If link parameter is provided, find the specific match
        for (const match of competitionData.matches) {
            if (match.matchLink === link) {
                return res.json(match);
            }
        }
        
        return res.json("Match is no longer active");
    } catch (error) {
        console.error(`Error fetching matches for ${req.params.region}/${req.params.competition}:`, error);
        res.status(500).json({ 
            error: 'Failed to fetch matches',
            details: error.message 
        });
    }
});

module.exports = router;