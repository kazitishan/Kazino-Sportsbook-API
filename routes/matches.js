const express = require('express');
const router = express.Router();
const { getMatches, getAllMatches } = require('../scraper');
const competitions = require('../competitions.json');

router.get('/', async (req, res) => {
    try {
        const allMatches = await getAllMatches();
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
        const competition = competitions.find(c => 
            c.competition.toLowerCase() === competitionName.toLowerCase()
        );
        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }
        const matches = await getMatches(competition.link);
        res.json({
            competition: competition.competition,
            matches: matches
        });
    } catch (error) {
        console.error(`Error fetching matches for ${req.params.competition}:`, error);
        res.status(500).json({ 
            error: 'Failed to fetch matches',
            details: error.message 
        });
    }
});

module.exports = router;