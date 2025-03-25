import fetch from "node-fetch";
import mammoth from "mammoth";
import pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve(
  "pdfjs-dist/build/pdf.worker.js"
);

const extensionToType = {
  txt: "text",
  md: "text",
  csv: "text",
  html: "text",
  yaml: "text",
  json: "json",
  docx: "docx",
  pdf: "pdf",
  xlsx: "xlsx",
};

// Builds knowledgeSources dynamically from GitHub rep
export async function getKnowledgeSourcesFromGithub() {
  const repoApiUrl = "https://api.github.com/repos/reinisvaravs/discord-bot-test-info/contents/";
  const sources = [];

  try {
    const res = await fetch(repoApiUrl);
    const files = await res.json();

    for (const file of files) {
      if (file.type !== "file") continue;
      const ext = file.name.split(".").pop();
      const type = extensionToType[ext];
      if (!type) continue;

      sources.push({ url: file.download_url, type });
    }
  } catch (err) {
    console.error("❌ Failed to load file list from GitHub:", err.message);
  }

  return sources;
}

export async function fetchRemoteKnowledge(sources) {
  let output = "";

  for (const { url, type } of sources) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`❌ Failed to fetch ${url}`);
        continue;
      }

      if (type === "json") {
        const data = await res.json();
        output += `\n[${url.split("/").pop()}]\n${JSON.stringify(
          data,
          null,
          2
        )}\n`;
      } else if (type === "text") {
        const text = await res.text();
        output += `\n[${url.split("/").pop()}]\n${text}\n`;
      } else if (type === "docx") {
        const arrayBuffer = await res.arrayBuffer();
        const { value } = await mammoth.extractRawText({
          buffer: Buffer.from(arrayBuffer),
        });
        output += `\n[${url.split("/").pop()}]\n${value}\n`;
      } else if (type === "pdf") {
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

        output += `\n[${url.split("/").pop()}]\n${textContent}\n`;
      } else if (type === "xlsx") {
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

        output += `\n[${url.split("/").pop()}]\n${sheetText}\n`;
      }
    } catch (err) {
      console.error(`🔥 Error fetching/parsing ${url}:`, err.message);
    }
  }

  return output;
}
