const fs = require("fs");
const https = require("https");

const hmsUrl =
  "https://raw.githubusercontent.com/bambulab/BambuStudio/refs/heads/master/resources/hms/hms_en_094.json";
const queryUrl = "https://e.bambulab.com/query.php?lang=en";
const mergedLocalFile = "data/ecodes.json";

// Function to download a JSON file
function downloadJsonFile(url) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading JSON from: ${url}`);
    // Ensure directory exists

    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          let data = "";
          response.on("data", (chunk) => {
            data += chunk;
          });
          response.on("end", () => {
            try {
              const json = JSON.parse(data);

              resolve(json);
            } catch (error) {
              reject(new Error(`Invalid JSON data: ${error.message}`));
            }
          });
        } else {
          reject(new Error(`HTTP error! status: ${response.statusCode}`));
        }
      })
      .on("error", (error) => {
        reject(new Error(`Download error: ${error.message}`));
      });
  });
}

// Deep merge: recursively merge hmsData and queryData
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      target[key] = deepMerge({ ...target[key] }, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Main execution
async function main() {
  try {
    // Download both JSON files
    const hmsData = await downloadJsonFile(hmsUrl);
    const queryData = await downloadJsonFile(queryUrl);

    const mergedJson = deepMerge({ ...queryData }, hmsData);

    fs.writeFileSync(mergedLocalFile, JSON.stringify(mergedJson, null, 2));
    console.log(`Merged JSON saved to: ${mergedLocalFile}`);
  } catch (error) {
    console.error(error.message);
  }
}

// Run the main function
main();
