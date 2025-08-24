const express = require('express');
const router = express.Router();
const { getCachedMatches, getLiveMatches, getTodaysMatches } = require('../scraper');
const errors = require('../errors');

router.get('/', async (req, res) => {
    try {
        if (req.query.live === 'true') {
            const liveMatches = await getLiveMatches();
            return res.json(liveMatches);
        }

        if (req.query.today === 'true') {
            const todaysMatches = await getTodaysMatches();
            return res.json(todaysMatches);
        }

        const allMatches = getCachedMatches();
        if (!allMatches) {
            return res.status(errors.CACHE_NOT_READY.status).json(errors.CACHE_NOT_READY.body);
        }

        const dateFilter = req.query.date;
        
        if (dateFilter) {
            const filteredMatches = {};
            
            for (const [competitionKey, competitionData] of Object.entries(allMatches)) {
                const filteredMatchesForCompetition = competitionData.matches.filter(match => {
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
                
                if (filteredMatchesForCompetition.length > 0) {
                    filteredMatches[competitionKey] = {
                        competition: competitionData.competition,
                        matches: filteredMatchesForCompetition
                    };
                }
            }
            
            res.json(filteredMatches);
        } else {
            res.json(allMatches);
        }
    } catch (error) {
        console.error('Error in matches route:', error);
        res.status(500).json({ 
            error: 'Failed to process matches request',
            details: error.message 
        });
    }
});

router.get('/:competition', async (req, res) => {
    try {
        const competitionName = req.params.competition;
        const allMatches = getCachedMatches();
        const link = req.query.link;
        
        if (!allMatches) {
            return res.status(errors.CACHE_NOT_READY.status).json(errors.CACHE_NOT_READY.body);
        }

        const competitionData = Object.values(allMatches).find(
            comp => comp.competition.toLowerCase() === competitionName.toLowerCase()
        );

        if (!competitionData) {
            return res.status(errors.COMPETITION_NOT_FOUND.status).json(errors.COMPETITION_NOT_FOUND.body);
        }
        
        if (!link) {
            return res.json(competitionData);
        }

        for (const match of competitionData.matches) {
            if (match.matchLink === link) {
                return res.json(match);
            }
        }
        
        return res.json("Match is no longer active");
    } catch (error) {
        console.error(`Error fetching matches for ${req.params.competition}:`, error);
        res.status(500).json({ 
            error: 'Failed to fetch matches',
            details: error.message 
        });
    }
});

module.exports = router;