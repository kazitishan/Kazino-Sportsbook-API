const express = require('express');
const app = express();
const cors = require("cors");
const PORT = 8080;
const { refreshMatchesCache } = require('./scraper');

app.use(cors());
const matchesRouter = require('./routes/matches');
const resultRouter = require('./routes/result');
app.use('/matches', matchesRouter);
app.use('/result', resultRouter);

const server = app.listen(PORT, async () => {
    try {
        await refreshMatchesCache();
        setInterval(refreshMatchesCache, 1 * 60 * 1000);
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