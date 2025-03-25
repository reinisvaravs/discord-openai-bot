import fetch from "node-fetch"; // Used for making HTTP requests to GitHub and downloading file contents
import mammoth from "mammoth"; // For .docx (Word) files
import * as pdfjsLib from "pdfjs-dist"; // For .pdf files (pdf.js)
import * as XLSX from "xlsx"; // For .xlsx (Excel) files

// Maps file extensions to internal types so we know how to parse each one
const extensionToType = {
  txt: "text",
  md: "text",
  csv: "text",
  html: "text",
  htm: "text",
  yaml: "text",
  yml: "text",
  json: "json",
  docx: "docx",
  pdf: "pdf",
  xlsx: "xlsx",
};

// Loads the list of files in the GitHub repo and maps them into a standardized array
// Each file must have a supported extension from extensionToType
// returns: { url, type, name }[] — all files from github folder
export async function getKnowledgeSourcesFromGithub() {
  // github api which reads all file names in the folder
  const repoApiUrl =
    "https://api.github.com/repos/reinisvaravs/discord-bot-test-info/contents/";

  try {
    const res = await fetch(repoApiUrl, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
      }, // use a token to increase GitHub API request limit
    });
    const files = await res.json();

    // array = error
    if (!Array.isArray(files)) {
      throw new Error(files.message || "GitHub API did not return a file list");
    }

    return files
      .filter((file) => file.type === "file") // only process files
      .map((file) => {
        const ext = file.name.split(".").pop();
        const type = extensionToType[ext]; // map ext to internal parser type
        if (!type) return null;
        return {
          url: file.download_url,
          type,
          name: file.name,
        };
      })
      .filter(Boolean); // remove null entries (unsupported types)
  } catch (err) {
    console.error("❌ Failed to load file list from GitHub:", err.message);
  }
}

// Downloads and parses files based on their type
// Returns one large combined string
export async function fetchRemoteKnowledge(sources) {
  const allTextChunks = [];

  for (const { url, type, name } of sources) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`❌ Failed to fetch ${url}`);
        continue;
      }

      // json file
      if (type === "json") {
        const data = await res.json();
        allTextChunks.push(`\n[${name}]\n${JSON.stringify(data, null, 2)}\n`);
      }

      // txt, md, html, htm, yaml, yml, csv
      else if (type === "text") {
        const text = await res.text();
        allTextChunks.push(`\n[${name}]\n${text}\n`);
      }

      // docx file
      else if (type === "docx") {
        const arrayBuffer = await res.arrayBuffer();
        const { value } = await mammoth.extractRawText({
          buffer: Buffer.from(arrayBuffer),
        });
        allTextChunks.push(`\n[${name}]\n${value}\n`);
      }

      // pdf file
      else if (type === "pdf") {
        const arrayBuffer = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
        }).promise;

        let textContent = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item) => item.str).join(" ");
          textContent += pageText + "\n";
        }

        allTextChunks.push(`\n[${name}]\n${textContent}\n`);
      }

      // xlsx file
      else if (type === "xlsx") {
        const arrayBuffer = await res.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "buffer" });
        let sheetText = "";

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          sheetText += `Sheet: ${sheetName}\n`;
          json.forEach((row) => {
            sheetText += row.join(", ") + "\n";
          });
        });

        allTextChunks.push(`\n[${name}]\n${sheetText}\n`);
      }
    } catch (err) {
      console.error(`🔥 Error fetching/parsing ${url}:`, err.message);
    }
  }

  // Return one large combined string with all parsed content
  return allTextChunks.join("\n\n");
}
