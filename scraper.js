const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const errors = require('./errors');

let cachedAllMatches = null;
let browserInstance = null;

async function createBrowser() {
    return await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
}

async function closeBrowser(browser) {
    if (browser) {
        await browser.close();
    }
}

async function getResult(matchLink) {
    if (!browserInstance) throw errors.BROWSER_NOT_INITIALIZED.error;
    const page = await browserInstance.newPage();
    try {
        const fullUrl = `https://www.betexplorer.com${matchLink}`;
        await page.goto(fullUrl);
        const result = await page.evaluate(() => {
            const scoreElement = document.querySelector('p.list-details__item__score');
            if (!scoreElement) return null;
            const scoreText = scoreElement.textContent.trim();
            if (scoreText === ':') return 'Match not played yet';
            const scoreMatch = scoreText.match(/(\d+):(\d+)/);
            if (!scoreMatch) return 'Score format not recognized';
            const homeScore = parseInt(scoreMatch[1]);
            const awayScore = parseInt(scoreMatch[2]);
            if (homeScore > awayScore) return 'HOME';
            else if (homeScore < awayScore) return 'AWAY';
            else return 'DRAW';
        });
        await page.close();
        return result;
    } catch (error) {
        await page.close();
        throw new Error(`Error fetching result: ${error.message}`);
    }
}

async function getMatches(fixturesUrl) {
    if (!browserInstance) throw errors.BROWSER_NOT_INITIALIZED.error;
    const page = await browserInstance.newPage();
    try {
        await page.goto(fixturesUrl);
        const matches = await page.evaluate(() => {
            let lastValidDate = null;

            function parseDateTime(dateTimeText) {
                if (!dateTimeText) return lastValidDate || 'Date not available';

                const now = new Date();
                const currentYear = now.getFullYear();
                let matchDate;
                let hour, minute;

                if (dateTimeText.includes('Today')) {
                    matchDate = new Date(now);
                    const timeMatch = dateTimeText.match(/(\d{1,2}):(\d{2})/);
                    if (timeMatch) {
                        hour = parseInt(timeMatch[1]) - 1;
                        minute = parseInt(timeMatch[2]);
                    }
                } else if (dateTimeText.includes('Tomorrow')) {
                    matchDate = new Date(now);
                    matchDate.setDate(matchDate.getDate() + 1);
                    const timeMatch = dateTimeText.match(/(\d{1,2}):(\d{2})/);
                    if (timeMatch) {
                        hour = parseInt(timeMatch[1]) - 1;
                        minute = parseInt(timeMatch[2]);
                    }
                } else {
                    const dateMatch = dateTimeText.match(/(\d{1,2})\.(\d{1,2})\.\s+(\d{1,2}):(\d{2})/);
                    if (dateMatch) {
                        const day = parseInt(dateMatch[1]);
                        const month = parseInt(dateMatch[2]) - 1;
                        hour = parseInt(dateMatch[3]) - 1;
                        minute = parseInt(dateMatch[4]);
                        matchDate = new Date(currentYear, month, day);
                    }
                }
                if (matchDate && hour !== undefined && minute !== undefined) {
                    if (hour < 0) {
                        hour = 23;
                        matchDate.setDate(matchDate.getDate() - 1);
                    }
                    matchDate.setHours(hour, minute, 0, 0);
                    const formattedDate = String(matchDate.getMonth() + 1).padStart(2, '0') + '/' +
                                        String(matchDate.getDate()).padStart(2, '0') + '/' +
                                        matchDate.getFullYear();
                    const formattedTime = matchDate.getHours() + ':' + 
                                        String(matchDate.getMinutes()).padStart(2, '0');
                    lastValidDate = `${formattedDate} ${formattedTime} EST`;
                    return lastValidDate;
                }
                return lastValidDate || 'Date not available';
            }

            const tableRows = Array.from(document.querySelectorAll('tr')).filter(row => {
                const oddsCells = row.querySelectorAll('td.table-main__odds');
                return oddsCells.length > 0 && 
                       Array.from(oddsCells).some(cell => cell.querySelector('button'));
            });

            return tableRows.map(row => {
                const dateTimeCell = row.querySelector('td.table-main__datetime');
                const dateTime = dateTimeCell?.textContent.trim() || null;
                
                if (dateTime) {
                    lastValidDate = parseDateTime(dateTime);
                }

                const teams = row.querySelector('td.h-text-left a.in-match');
                const oddsButtons = Array.from(row.querySelectorAll('td.table-main__odds button'));

                return {
                    dateTime: dateTime ? lastValidDate : parseDateTime(dateTime),
                    homeTeam: teams?.querySelector('span:first-child')?.textContent.trim(),
                    awayTeam: teams?.querySelector('span:last-child')?.textContent.trim(),
                    odds: oddsButtons.map(btn => btn.textContent.trim()),
                    matchLink: teams?.getAttribute('href')
                };
            });
        });
        await page.close();
        return matches;
    } catch (error) {
        await page.close();
        throw new Error(`Error fetching matches: ${error.message}`);
    }
}

async function getAllMatches() {
    try {
        const competitionsPath = path.join(__dirname, 'competitions.json');
        const competitionsData = await fs.readFile(competitionsPath, 'utf8');
        const competitions = JSON.parse(competitionsData);
        const matchesByCompetition = {};
        for (const competition of competitions) {
            try {
                const matches = await getMatches(competition.link);
                matchesByCompetition[competition.competition] = {
                    competition: competition.competition,
                    matches: matches
                };
            } catch (error) {
                matchesByCompetition[competition.competition] = {
                    competition: competition.competition,
                    matches: []
                };
            }
        }
        return matchesByCompetition;
    } catch (error) {
        throw new Error(`Error in getAllMatches: ${error.message}`);
    }
}

async function refreshMatchesCache() {
    let browser;
    try {
        browser = await createBrowser();
        browserInstance = browser;
        cachedAllMatches = await getAllMatches();
        console.log(`[${getTimeStamp()}] Matches cache refreshed`);
    } catch (error) {
        console.error(`[${getTimeStamp()}] Failed to refresh matches cache:`, error);
    } finally {
        if (browser) {
            await closeBrowser(browser);
            browserInstance = null;
        }
    }
}

function getCachedMatches() {
    return cachedAllMatches;
}

function getTimeStamp(){
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour12: true,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return timestamp;
}

module.exports = {
    createBrowser,
    closeBrowser,
    getResult,
    getMatches,
    getAllMatches,
    refreshMatchesCache,
    getCachedMatches
};