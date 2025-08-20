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

// Main execution
async function main() {
  try {
    // Download both JSON files
    const hmsData = await downloadJsonFile(hmsUrl);
    const queryData = await downloadJsonFile(queryUrl);

    // Shallow merge: combine top-level keys, query keys overwrite hms keys if duplicated
    const mergedJson = { ...hmsData, ...queryData };
    fs.writeFileSync(mergedLocalFile, JSON.stringify(mergedJson, null, 2));
    console.log(`Merged JSON saved to: ${mergedLocalFile}`);

    // Extract ecode arrays from both
    const hmsEcodes = Array.isArray(hmsData?.data?.device_error?.en)
      ? hmsData.data.device_error.en
      : [];
    const queryEcodes = Array.isArray(queryData?.data?.device_error?.en)
      ? queryData.data.device_error.en
      : [];

    // Merge and deduplicate ecodes (by ecode string)
    const mergedEcodes = [
      ...hmsEcodes,
      ...queryEcodes.filter(
        (qe) => !hmsEcodes.some((he) => he.ecode === qe.ecode)
      ),
    ];

    console.log(`Total merged  entries: ${mergedEcodes.length}`);
  } catch (error) {
    console.error(error.message);
  }
}

// Run the main function
main();
