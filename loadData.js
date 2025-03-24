import { readdirSync, readFileSync } from "fs";
import path from "path";
import { getDocument } from "pdfjs-dist";
import mammoth from "mammoth";
import xlsx from "xlsx";
import * as cheerio from "cheerio";
import yaml from "js-yaml";

export async function loadAllDataFromFolder(folderPath) {
  const files = readdirSync(folderPath);
  let output = "";

  for (const file of files) {
    const ext = path.extname(file);
    const fileName = path.basename(file, ext);
    const fullPath = path.join(folderPath, file);

    try {
      if (ext === ".txt" || ext === ".md") {
        const text = readFileSync(fullPath, "utf8");
        output += `\n[${fileName}]\n${text}\n`;
      } else if (ext === ".json") {
        const json = JSON.parse(readFileSync(fullPath, "utf8"));
        output += `\n[${fileName}]\n${formatJsonToText(json)}\n`;
      } else if (ext === ".csv") {
        const raw = readFileSync(fullPath, "utf8");
        const lines = raw.trim().split("\n");
        const headers = lines[0].split(",");

        const rows = lines.slice(1).map((line) => {
          const values = line.split(",");
          return values.map((v) => v.trim());
        });

        output += `\n[${fileName}]\n`;
        for (const row of rows) {
          const line = headers.map((h, i) => `${row[i]} (${h})`).join(", ");
          output += `- ${line}\n`;
        }
      } else if (ext === ".pdf") {
        const text = await extractTextFromPDF(fullPath);
        output += `\n[${fileName}]\n${text}\n`;
      } else if (ext === ".docx") {
        const buffer = readFileSync(fullPath);
        const result = await mammoth.extractRawText({ buffer });
        const cleaned = result.value.replace(/\n{3,}/g, "\n\n");
        output += `\n[${fileName}]\n${cleaned}\n`;
      } else if (ext === ".xlsx") {
        const workbook = xlsx.readFile(fullPath);
        const sheetNames = workbook.SheetNames;

        for (const sheetName of sheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

          output += `\n[${fileName} - ${sheetName}]\n`;

          for (const row of data) {
            const line = row.join(" | ");
            output += `- ${line}\n`;
          }
        }
      } else if (ext === ".html" || ext === ".htm") {
        const html = readFileSync(fullPath, "utf8");
        const $ = cheerio.load(html);
        const visibleText = $("body").text().replace(/\s+/g, " ").trim();
        output += `\n[${fileName}]\n${visibleText}\n`;
      } else if (ext === ".yaml" || ext === ".yml") {
        const raw = readFileSync(fullPath, "utf8");
        const parsed = yaml.load(raw);
        const formatted = formatJsonToText(parsed);
        output += `\n[${fileName}]\n${formatted}\n`;
      }
    } catch (err) {
      console.error(`Failed to load ${file}:`, err);
    }
  }

  return output;
}

async function extractTextFromPDF(filePath) {
  const loadingTask = getDocument(filePath);
  const pdf = await loadingTask.promise;

  let text = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    text += strings.join(" ") + "\n";
  }

  return text;
}

function formatJsonToText(json) {
  let result = "";
  for (const key in json) {
    const value = json[key];
    if (Array.isArray(value)) {
      result += `${key}: ${value.join(", ")}\n`;
    } else if (typeof value === "object" && value !== null) {
      result += `${key}:\n`;
      for (const subKey in value) {
        result += `  ${subKey}: ${value[subKey]}\n`;
      }
    } else {
      result += `${key}: ${value}\n`;
    }
  }
  return result;
}
