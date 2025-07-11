const express = require('express');
const app = express();
const cors = require("cors");
const PORT = 8080;
const { initBrowser, closeBrowser, refreshMatchesCache } = require('./scraper');

app.use(cors());
const matchesRouter = require('./routes/matches');
const resultRouter = require('./routes/result');
app.use('/matches', matchesRouter);
app.use('/result', resultRouter);

const server = app.listen(PORT, async () => {
    try {
        await initBrowser();
        await refreshMatchesCache();
        
        // Refresh cache every minute
        setInterval(refreshMatchesCache, 1 * 60 * 1000);
        console.log(`Server running on port ${PORT}`);
    } catch (error) {
        console.error('Failed to initialize browser:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    try {
        await closeBrowser();
        server.close(() => {
            process.exit(0);
        });
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}