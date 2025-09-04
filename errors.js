module.exports = {
    CACHE_NOT_READY: {
        status: 503,
        body: {
            error: 'Matches data not available yet',
            message: 'Cache is being initialized, please try again shortly'
        }
    },
    COMPETITION_NOT_FOUND: {
        status: 404,
        body: {
            error: 'Competition not found'
        }
    },
    REGION_NOT_FOUND: {
        status: 404,
        body: { 
            error: 'Region not found.'
        }
    },
    BROWSER_NOT_INITIALIZED: {
        error: new Error('Browser not initialized')
    }
};