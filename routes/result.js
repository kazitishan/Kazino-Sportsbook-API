const express = require('express');
const router = express.Router();
const { getResult } = require('../scraper');

router.get('/', async (req, res) => {
    const link = req.query.link;

    if (!link) {
        return res.status(400).json({ 
            error: 'Missing link parameter' 
        });
    }

    try {
        const result = await getResult(link);
        res.json(result);
    } catch (error) {
        console.error('Error in result route:', error);
        res.status(500).json({ 
            error: 'Failed to process result request',
            details: error.message 
        });
    }
});

module.exports = router;