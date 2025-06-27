const express = require('express');
const app = express();
const cors = require("cors");
const PORT = 8080;
const { initBrowser, closeBrowser } = require('./scraper');

app.use(cors());
const matchesRouter = require('./routes/matches');
app.use('/matches', matchesRouter);

const server = app.listen(PORT, async () => {
    try {
        await initBrowser();
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