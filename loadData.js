import { readdirSync, readFileSync } from "fs";
import path from "path";

export function loadAllDataFromFolder(folderPath) {
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
      } 
      else if (ext === ".json") {
        const json = JSON.parse(readFileSync(fullPath, "utf8"));
        output += `\n[${fileName}]\n${formatJsonToText(json)}\n`;
      } 
      else if (ext === ".csv") {
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
      }
    } catch (err) {
      console.error(`Failed to load ${file}:`, err);
    }
  }

  return output;
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
