import "colors";
import fs from "fs";
import path from "path";
import "dotenv/config";
import { version } from "./version";
import execa from "execa";

const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60 * 24; // 1 day in milliseconds
const updateCheckFile = path.join(__dirname, "lastUpdateCheck.json");

function readLastUpdateCheck() {
  if (fs.existsSync(updateCheckFile)) {
    const data = fs.readFileSync(updateCheckFile, "utf-8");
    try {
      return JSON.parse(data).timestamp;
    } catch (error) {
      console.error("Error parsing last update check file:", error);
      return 0;
    }
  }
  return 0;
}

function writeLastUpdateCheck() {
  const now = Date.now();
  fs.writeFileSync(updateCheckFile, JSON.stringify({ timestamp: now }));
}

function shouldCheckForUpdates() {
  const lastCheck = readLastUpdateCheck();
  const now = Date.now();
  return now - lastCheck > UPDATE_CHECK_INTERVAL;
}

async function fetchLatestVersion() {
  const response = await fetch("https://registry.npmjs.org/gitconv");
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const packageInfo = await response.json();
  return packageInfo["dist-tags"].latest;
}

function runUpdate() {
  console.log("Running update...".cyan);

  try {
    execa.sync("npm", ["install", "-g", "gitconv@latest"], {
      buffer: false,
      stdio: "inherit",
    });
    console.log("Update completed!".green);
  } catch (e) {
    const error = e as execa.ExecaError;
    console.error("Error during update:", error.message);
    if (error.stderr) {
      console.error("Update stderr:", error.stderr);
    }
  } finally {
    process.exit(0);
  }
}

export async function checkForUpdates(forceCheck = false) {
  if (shouldCheckForUpdates() || forceCheck) {
    try {
      const latestVersion = await fetchLatestVersion();

      writeLastUpdateCheck(); // Update the last check timestamp

      if (version !== latestVersion) {
        console.log(
          `A new version of gitconv is available: ${latestVersion.blue}`.yellow
        );
        console.log(`Your current version is: ${version.blue}`.yellow);
        if (forceCheck) {
          runUpdate();
        } else {
          console.log(
            `You can update with: ${"npm install -g gitconv@latest".cyan} or ${"gitconv -u".cyan}`
              .yellow
          );
        }
      } else if (forceCheck) {
        console.log("No updates available.".green);
        console.log("Your current version is: ".green, version.blue);
      }

      if (forceCheck) process.exit(0);
    } catch (error) {
      console.error("Error checking for updates:", error); // Log the error message
    }
  }
}
