const express = require('express');
const router = express.Router();
const { getCachedMatches } = require('../scraper');
const errors = require('../errors');

router.get('/', async (req, res) => {
    try {
        const allMatches = getCachedMatches();
        if (!allMatches) {
            return res.status(errors.CACHE_NOT_READY.status).json(errors.CACHE_NOT_READY.body);
        }
        res.json(allMatches);
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
        
        if (!allMatches) {
            return res.status(errors.CACHE_NOT_READY.status).json(errors.CACHE_NOT_READY.body);
        }

        const competitionData = Object.values(allMatches).find(
            comp => comp.competition.toLowerCase() === competitionName.toLowerCase()
        );

        if (!competitionData) {
            return res.status(errors.COMPETITION_NOT_FOUND.status).json(errors.COMPETITION_NOT_FOUND.body);
        }

        res.json(competitionData);
    } catch (error) {
        console.error(`Error fetching matches for ${req.params.competition}:`, error);
        res.status(500).json({ 
            error: 'Failed to fetch matches',
            details: error.message 
        });
    }
});

module.exports = router;