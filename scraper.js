const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const errors = require('./errors');

let cachedAllMatches = null;
let cachedTodaysMatches = null;
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
        await page.goto(fullUrl, { waitUntil: 'networkidle0' });
        const result = await page.evaluate(() => {
            const liveElement = document.querySelector('li.oddsComparison__li.oddsComparison__liveOdds_li.oddsComparison__liveOdds_activeLi');
            if (liveElement) {
                return 'Match is still being played';
            }
            
            const scoreElement = document.querySelector('p.list-details__item__score');
            if (!scoreElement) return null;
            const scoreText = scoreElement.textContent.trim();
            if (scoreText === ':') return 'Match not played yet';
            
            const scoreMatch = scoreText.match(/(\d+):(\d+)/);
            if (!scoreMatch) return 'Score format not recognized';
            
            // Get the match date from the data-dt attribute
            const dateElement = document.querySelector('p.list-details__item__date.headerTournamentDate.partialResultsHeight');
            const matchDate = dateElement.getAttribute('data-dt');
            
            // Find the head-to-head row with matching data-dt
            const h2hRows = document.querySelectorAll('div.head-to-head__row');
            let targetRow = null;
            
            for (const row of h2hRows) {
                if (row.getAttribute('data-dt') === matchDate) {
                    targetRow = row;
                    break;
                }
            }
            
            // Find the odds container
            const oddsContainer = targetRow.querySelector('div.table-main__oddsLi.mobileGap.oddsColumn div.table-main__oddsLi.mobileGap.oddsColumn');
            
            // Check each of the three odds divs for the winner class
            const oddsDivs = oddsContainer.children;
            for (let i = 0; i < 3; i++) {
                const oddsDiv = oddsDivs[i];
                if (oddsDiv.classList.contains('table-main__odds') && 
                    oddsDiv.classList.contains('table-main__odd') && 
                    oddsDiv.classList.contains('oddMobile') && 
                    oddsDiv.classList.contains('oddsWinnerBold')) {
                    
                    if (i === 0) return 'HOME';
                    else if (i === 1) return 'DRAW';
                    else if (i === 2) return 'AWAY';
                }
            }
            
            return 'Winner can not determined';
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
                    const formattedDate = String(matchDate.getMonth() + 1).padStart(2, '0') + '-' +
                                        String(matchDate.getDate()).padStart(2, '0') + '-' +
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

async function setTimezone(timezone = -5, page) {
    try {
        const timezoneSet = await page.evaluate(async (targetTimezone) => {
            const timezoneTriggers = document.querySelectorAll('[class*="timezone"], [onclick*="timezone"]');
            
            for (const trigger of timezoneTriggers) {
                try {
                    trigger.click();
                    await new Promise(resolve => setTimeout(resolve, 50));
                    break;
                } catch (e) {
                    continue;
                }
            }
            
            // Now look for the timezone list
            const timezoneList = document.querySelector('ul.timezone__list.visible');
            if (!timezoneList) {
                // If not visible, try to find any timezone list
                const allLists = document.querySelectorAll('ul.timezone__list');
                if (allLists.length > 0) {
                    allLists[0].style.display = 'block';
                    allLists[0].classList.add('visible');
                }
            }
            
            const finalList = document.querySelector('ul.timezone__list.visible');
            if (!finalList) return false;
            
            const timezoneItems = finalList.querySelectorAll('li');
            let targetItem = null;
            
            // Find the timezone item that matches our target
            for (const item of timezoneItems) {
                const button = item.querySelector('button');
                if (button && button.getAttribute('onclick')) {
                    const timezoneMatch = button.getAttribute('onclick').match(/set_timezone\('([+-]?\d+)'\)/);
                    if (timezoneMatch && parseInt(timezoneMatch[1]) === targetTimezone) {
                        targetItem = item;
                        break;
                    }
                }
            }
            
            // Check if it's already selected
            if (targetItem) {
                console.log("yuhhhh")
                const button = targetItem.querySelector('button');
                if (button && !button.classList.contains('current')) {
                    button.click();
                    return true;
                }
            }
            
            return false;
        }, timezone);
        
        // Wait if timezone was changed
        if (timezoneSet) {
            await new Promise(resolve => setTimeout(resolve, 1 * 1000));
        }
        
        return true;
    } catch (error) {
        console.error(`[${getTimeStamp()}] Error setting timezone:`, error.message);
        return false;
    }
}

async function scrapeTodaysMatches(page) {
    // Scroll to bottom every 0.2 seconds until no new content for 2 seconds
    await page.evaluate(async () => {
        const delay = 0.2 * 1000; // 0.2 seconds
        let lastHeight = document.body.scrollHeight;
        let noChangeStartTime = null;
        
        while (true) {
            // Scroll to bottom
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Check if page height changed
            const newHeight = document.body.scrollHeight;
            if (newHeight > lastHeight) {
                lastHeight = newHeight;
                noChangeStartTime = null;
            } else {
                if (noChangeStartTime === null) { 
                    noChangeStartTime = Date.now(); 
                } else if (Date.now() - noChangeStartTime >= 2000) { 
                    break; 
                }
            }
        }
    });
    
    const todaysMatches = await page.evaluate(() => {
        const competitionsArray = [];
        const competitionElements = document.querySelectorAll('ul.leagues-list, ul.leagues-list.topleague');
        
        competitionElements.forEach(compElement => {
            // Get competition name
            const firstLi = compElement.querySelector('li:first-child');
            const competitionNameElement = firstLi?.querySelector('p.table-main__truncate.table-main__leaguesNames.leaguesNames');
            let competitionName = '';
            let category = '';
            
            if (competitionNameElement) {
                const fullName = competitionNameElement.textContent.trim();
                const colonIndex = fullName.indexOf(':');
                if (colonIndex !== -1) {
                    category = fullName.substring(0, colonIndex).trim();
                    competitionName = fullName.substring(colonIndex + 1).trim();
                } else {
                    category = 'General';
                    competitionName = fullName;
                }
            }
            
            // Get all match elements
            const matchElements = Array.from(compElement.querySelectorAll('li:not(:first-child)'));
            const matches = [];
            
            matchElements.forEach(matchElement => {
                const matchUl = matchElement.querySelector('ul.table-main__matchInfo');
                if (!matchUl) return;
                
                // Check if this match has odds, if not skip it
                const oddsContainer = matchUl.querySelector('div.table-main__oddsLi.mobileGap.oddsColumn');
                if (!oddsContainer) return;
                
                // Check if the odds are empty, if so skip it
                const oddsElements = oddsContainer.querySelectorAll('div.table-main__odds');
                let hasValidOdds = false;
                oddsElements.forEach(oddElement => {
                    let oddValue = '';
                    
                    const buttonElement = oddElement.querySelector('button');
                    if (buttonElement) {
                        oddValue = buttonElement.textContent.trim();
                    }
                    
                    const pElement = oddElement.querySelector('p');
                    if (pElement) {
                        oddValue = pElement.textContent.trim();
                    }
                    
                    const liveOddsElement = oddElement.querySelector('p.liveOdds');
                    if (liveOddsElement) {
                        oddValue = liveOddsElement.textContent.trim();
                    }
                    
                    if (oddValue !== '') {
                        hasValidOdds = true;
                    }
                });
                if (!hasValidOdds) return;
                
                // Check match status
                const statusElement = matchUl.querySelector('li.table-main__matchDateStatus span');
                const statusClass = statusElement?.className || '';
                const statusText = statusElement?.textContent.trim() || '';
                
                let status, minute, dateTime, score, result = null;
                let live, finished = false;
                
                // Determine match status
                if (statusClass.includes('table-main__isLive')) {
                    status = 'Being played right now';
                    minute = statusText;
                    live = true;
                } else if (statusText === 'FIN') {
                    status = 'Finished';
                    finished = true;
                } else if (statusText === 'AET') {
                    status = 'Finished after extra time';
                    finished = true;
                } else if (statusText === 'AfP') {
                    status = 'Finished after penalties';
                    finished = true;
                } else if (statusText === 'AWA.' || statusText === 'CAN.') { // Awarded and cancelled games
                    return;
                } else {
                    status = 'Not Played Yet';
                    const today = new Date();
                    const formattedDate = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-${today.getFullYear()}`;
                    dateTime = `${formattedDate} ${statusText} EST`;
                }

                if (finished) {
                    // Determine result for finished matches
                    const oddsDivs = oddsContainer.children;
                    for (let i = 0; i < 3; i++) {
                        if (oddsDivs[i].classList.contains('table-main__OddsWinner') && 
                            oddsDivs[i].classList.contains('winner')) {
                            if (i === 0) result = 'HOME';
                            else if (i === 1) result = 'DRAW';
                            else if (i === 2) result = 'AWAY';
                            break;
                        }
                    }
                }

                // Get teams and score
                const participantsElement = matchUl.querySelector('li.table-main__participants');
                const homeTeamElement = participantsElement?.querySelector('div.table-main__participantHome p');
                const awayTeamElement = participantsElement?.querySelector('div.table-main__participantAway p');
                const homeTeam = homeTeamElement?.textContent.trim() || '';
                const awayTeam = awayTeamElement?.textContent.trim() || '';
                
                // Get score if available
                const scoreElement = participantsElement?.querySelector('div.liveResult, div.mainResult');
                if (scoreElement) {
                    const scoreParts = scoreElement.querySelectorAll('div.table-main__liveResults, div.table-main__finishedResults');
                    if (scoreParts.length >= 3) {
                        const homeGoals = scoreParts[0].textContent.trim();
                        const awayGoals = scoreParts[2].textContent.trim();
                        score = `${homeGoals}:${awayGoals}`;
                    }
                }
                
                // Get odds
                const odds = [];
                oddsElements.forEach(oddElement => {
                    let oddValue = '';
                    
                    // Check for button (not played yet)
                    const buttonElement = oddElement.querySelector('button');
                    if (buttonElement) {
                        oddValue = buttonElement.textContent.trim();
                    }
                    
                    // Check for p tag (finished or live)
                    const pElement = oddElement.querySelector('p');
                    if (pElement) {
                        oddValue = pElement.textContent.trim();
                    }
                    
                    // Check for p.liveOdds (live matches)
                    const liveOddsElement = oddElement.querySelector('p.liveOdds');
                    if (liveOddsElement) {
                        oddValue = liveOddsElement.textContent.trim();
                    }
                    
                    odds.push(oddValue);
                });
                
                // Get match link
                const matchLinkElement = participantsElement?.querySelector('a');
                const matchLink = matchLinkElement?.getAttribute('href') || '';
                
                // Create match object based on status
                const matchObj = {
                    status,
                    homeTeam,
                    awayTeam,
                    odds,
                    matchLink,
                    live,
                    finished
                };
                
                // Add status-specific fields
                if (status === 'Not Played Yet') {
                    matchObj.dateTime = dateTime;
                } else if (live) { // 'Being played right now'
                    matchObj.minute = minute;
                    matchObj.score = score;
                } else if (finished) { // 'Finished'
                    matchObj.score = score;
                    matchObj.result = result;
                }
                
                matches.push(matchObj);
            });
            
            if (matches.length > 0) {
                competitionsArray.push({
                    region: category,
                    competition: competitionName,
                    matches
                });
            }
        });
        
        return competitionsArray;
    });
    
    return todaysMatches;
}

async function getTodaysMatches() {
    if (!browserInstance) throw errors.BROWSER_NOT_INITIALIZED.error;
    
    let todaysMatchesPage = await browserInstance.newPage();
    await todaysMatchesPage.goto('https://www.betexplorer.com/', { waitUntil: 'networkidle0' });
    
    await setTimezone(-5, todaysMatchesPage);
    return await scrapeTodaysMatches(todaysMatchesPage);
}

async function getAllMatches() {
    try {
        const competitionsPath = path.join(__dirname, 'competitions.json');
        const competitionsData = await fs.readFile(competitionsPath, 'utf8');
        const competitions = JSON.parse(competitionsData);
        const matchesByCompetition = [];
        
        for (const competition of competitions) {
            try {
                const formattedRegion = competition.region.replace(/\s+/g, '-').toLowerCase();
                const formattedCompetition = competition.competition.replace(/\s+/g, '-').toLowerCase();
                const fixturesUrl = `https://www.betexplorer.com/football/${formattedRegion}/${formattedCompetition}/fixtures/`;

                const matches = await getMatches(fixturesUrl);
                matchesByCompetition.push({
                    region: competition.region,
                    competition: competition.competition,
                    matches: matches
                });
            } catch (error) {
                matchesByCompetition.push({
                    region: competition.region,
                    competition: competition.competition,
                    matches: []
                });
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
        if (browserInstance) {
            await closeBrowser(browserInstance);
            browserInstance = null;
        }
        
        browser = await createBrowser();
        browserInstance = browser;
        cachedAllMatches = await getAllMatches();
        console.log(`[${getTimeStamp()}] All Matches cache refreshed`);
    } catch (error) {
        console.error(`[${getTimeStamp()}] Failed to refresh all matches cache:`, error);
    }
}

async function refreshTodaysMatchesCache() {
    let browser;
    try {
        if (browserInstance) {
            await closeBrowser(browserInstance);
            browserInstance = null;
        }
        
        browser = await createBrowser();
        browserInstance = browser;
        cachedTodaysMatches = await getTodaysMatches();
        console.log(`[${getTimeStamp()}] Today's matches cache refreshed`);
    } catch (error) {
        console.error(`[${getTimeStamp()}] Failed to refresh today's matches cache:`, error);
    }
}

async function refreshCache(){
    let count = 0;
    const SECONDS_BETWEEN_REFRESH = 20
    
    setInterval(async () => {
        try {
            await refreshTodaysMatchesCache();
            count++;
            
            if (count === 100) {
                count = 0;
                await refreshMatchesCache();
            }
        } catch (error) {
            console.error(`[${getTimeStamp()}] Error in refresh cycle:`, error);
        }
    }, SECONDS_BETWEEN_REFRESH * 1000);
}

function getCachedMatches() {
    return cachedAllMatches;
}

function getCachedTodaysMatches(){
    return cachedTodaysMatches;
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
    getTodaysMatches,
    getAllMatches,
    refreshMatchesCache,
    refreshTodaysMatchesCache,
    refreshCache,
    getCachedMatches,
    getCachedTodaysMatches
};