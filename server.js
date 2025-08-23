const express = require('express');
const cors = require("cors");
const matchesRouter = require('./routes/matches');
const resultRouter = require('./routes/result');
const { refreshMatchesCache } = require('./scraper');

const app = express();
const PORT = 8080;
const MINUTES_BETWEEN_REFRESH = 1;

app.use(cors());
app.use('/matches', matchesRouter);
app.use('/result', resultRouter);

const server = app.listen(PORT, async () => {
    try {
        await refreshMatchesCache();
        setInterval(refreshMatchesCache, MINUTES_BETWEEN_REFRESH * 60 * 1000);
        console.log(`Server running on port ${PORT}`);
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