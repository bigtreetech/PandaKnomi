const fs = require("fs");
const https = require("https");

const hmsUrl =
  "https://raw.githubusercontent.com/bambulab/BambuStudio/refs/heads/master/resources/hms/hms_en_094.json";
const queryUrl = "https://e.bambulab.com/query.php?lang=en";
const mergedLocalFile = "data/ecodes.json";
const outputFile = "data/ecodes-qr.json";

// Function to convert ecode to HMS link format
function ecodeToHmsLink(ecode) {
  const hms = BigInt("0x" + ecode.padStart(16, "0"));
  const seg1 = Number((hms >> 48n) & 0xffffn);
  const seg2 = Number((hms >> 32n) & 0xffffn);
  const seg3 = Number((hms >> 16n) & 0xffffn);
  const seg4 = Number(hms & 0xffffn);
  const formatHex = (num) => num.toString(16).padStart(4, "0");
  return `https://e.bambulab.com/?e=${formatHex(seg1)}${formatHex(
    seg2
  )}${formatHex(seg3)}${formatHex(seg4)}&s=device_hms&lang=en`;
}

// Function to check page title for a given ecode
async function checkEcodeTitle(ecode) {
  try {
    const url = ecodeToHmsLink(ecode);
    const response = await fetch(url);

    if (response.status === 200) {
      const htmlContent = await response.text();
      const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";

      return {
        ecode: ecode,
        url: url,
        title: title,
        isHmsHomePage: title === "HMS home page | Bambu Lab Wiki",
      };
    }

    return {
      ecode: ecode,
      url: url,
      title: null,
      isHmsHomePage: false,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ecode: ecode,
      url: ecodeToHmsLink(ecode),
      title: null,
      isHmsHomePage: false,
      error: error.message,
    };
  }
}

// Function to check all ecodes with batching and delay
async function checkAllEcodes(ecodes, batchSize = 10, delayMs = 500) {
  console.log(`Checking ${ecodes.length} ecodes for page titles...`);
  const results = [];

  for (let i = 0; i < ecodes.length; i += batchSize) {
    const batch = ecodes.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        ecodes.length / batchSize
      )}`
    );

    const batchPromises = batch.map((ecodeObj) =>
      checkEcodeTitle(ecodeObj.ecode)
    );
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    if (i + batchSize < ecodes.length) {
      console.log(`Waiting ${delayMs}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

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
    console.log("Merged JSON saved to: data/merged.json");

    // Extract ecode arrays from both
    const hmsEcodes = Array.isArray(hmsData?.data?.device_hms?.en)
      ? hmsData.data.device_hms.en
      : [];
    const queryEcodes = Array.isArray(queryData?.data?.device_hms?.en)
      ? queryData.data.device_hms.en
      : [];

    // Merge and deduplicate ecodes (by ecode string)
    const mergedEcodes = [
      ...hmsEcodes,
      ...queryEcodes.filter(
        (qe) => !hmsEcodes.some((he) => he.ecode === qe.ecode)
      ),
    ];

    console.log(`Total merged HMS entries: ${mergedEcodes.length}`);

    // Check all ecodes for their page titles
    const allResults = await checkAllEcodes(mergedEcodes);

    // Filter ecodes that are NOT "HMS home page | Bambu Lab Wiki"
    const ecodesWithValidPages = allResults.filter(
      (result) => !result.isHmsHomePage
    );

    // Extract just the ecodes from valid pages
    const validEcodesArray = ecodesWithValidPages.map((result) => result.ecode);

    // Write results to JSON file as simple array
    fs.writeFileSync(outputFile, JSON.stringify(validEcodesArray, null, 2));

    console.log(`\n[HMS Page Checker] Done!`);
  } catch (error) {
    console.error("[HMS Page Checker] Error:", error.message);
  }
}

// Run the main function
main();
