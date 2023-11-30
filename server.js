const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let stats = null;

app.post("/hello", async (req, res) => {
    console.log("Getting the stats");
    let username = req.body.username;
    let platform = req.body.platform;
    res.status(200).send((await getBBStat(username, platform)) ?? (await stats));
    console.log("Screenshot taken");
});

app.listen(3000, () => {
    console.log("Listening on port 3000");
});

let stat = null;

// Function to get stats from the bug bounty platform
const getBBStat = async (username, platform) => {
    stats = null;
    const browser = await puppeteer.launch({
        args: [
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-setuid-sandbox",
            "--no-first-run",
            "--no-sandbox",
            "--no-zygote",
            "--deterministic-fetch",
            "--disable-features=IsolateOrigins",
            "--disable-site-isolation-trials",
        ],
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);
    await page.setDefaultNavigationTimeout(0);

    page.on("request", (request) => {
        request.continue();
    });

    page.on("response", async (response) => {
        if (platform === "hackerone" && response.url().endsWith("graphql")) {
            return await parseAndStoreResponse(await response.json(), platform);
        }
        if (platform === "bugcrowd" && response.url().endsWith(".json")) {
            return await parseAndStoreResponse(await response.json(), platform);
        }

        if (platform === "yeswehack") {
            return await parseAndStoreResponse(await response.json(), platform);
        }

        delay(500);
    });

    await page.goto(getPlatformUrl(platform, username), {
        waitUntil: "networkidle2",
    });

    await page.waitForTimeout(3000);

    browser.close();
};

// Function to construct the platform URL
function getPlatformUrl(platform, username) {
    const baseUrls = {
        hackerone: "https://hackerone.com/",
        bugcrowd: "https://bugcrowd.com/",
        yeswehack: "https://api.yeswehack.com/hunters/",
    };

    return baseUrls[platform] + username;
}

// Function to parse the response and store the stats
function parseAndStoreResponse(response, platform) {
    let tempResponse = null;

    if (platform === "hackerone" && response.data?.user?.statistics_snapshot) {
        tempResponse = response.data.user.statistics_snapshot;
    }

    if (platform === "bugcrowd" && response.statistics) {
        tempResponse = response.statistics;
    }

    if (platform === "yeswehack") {
        tempResponse = response;
    }

    if (tempResponse && tempResponse !== stat) {
        stat = tempResponse;
        if (stat) {
            console.log(stat);
            stats = stat;
            return stat;
        }
    }
}
