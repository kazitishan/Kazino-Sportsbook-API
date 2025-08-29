const express = require('express');
const cors = require("cors");
const matchesRouter = require('./routes/matches');
const resultRouter = require('./routes/result');
const { refreshMatchesCache, refreshTodaysMatchesCache, refreshCache } = require('./scraper');

const app = express();
const PORT = 8080;
const MINUTES_BETWEEN_REFRESH = 1;

app.use(cors());
app.use('/matches', matchesRouter);
app.use('/result', resultRouter);

const server = app.listen(PORT, async () => {
    try {
        console.log(`Server running on port ${PORT}`);
        await refreshMatchesCache();
        await refreshTodaysMatchesCache();
        refreshCache();
    } catch (error) {
        console.error('Failed to initialize:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    server.close(() => {
        process.exit(0);
    });
}