import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  parseCSV,
  parseCSVToSheetRecords,
  parseAnomaliesCSV,
  extractHtmlRowDates,
} from "./src/utils/sheetParser.ts";
import { SheetRecord, AnomalyRecord } from "./src/types.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // In-memory cache of parsed sheet records for instant AI querying
  let cachedSheetRecords: SheetRecord[] = [];
  let cachedAnomalies: AnomalyRecord[] = [];

  const DEFAULT_SHEET_ID = "1hIGJm0wYxgD7Q-SWXAtjRZBzxOE8Q7xVofKHg6Q1P1U";

  async function fetchSheetRecords(sheetUrl?: string): Promise<{
    records: SheetRecord[];
    tabs: string[];
    anomalies: AnomalyRecord[];
  }> {
    const targetUrl =
      sheetUrl ||
      `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/edit?usp=sharing`;

    const match = targetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const sheetId = match ? match[1] : DEFAULT_SHEET_ID;

    const allRecords: SheetRecord[] = [];
    const discoveredTabs: string[] = [];
    let anomalies: AnomalyRecord[] = [];

    // Attempt 1: Discover tabs and exact GIDs via Google Spreadsheet htmlview
    // This allows fetching the live, un-cached CSV directly from the Google Sheets export endpoint
    let tabMap: Array<{ name: string; gid: string }> = [];
    try {
      const htmlRes = await fetch(
        `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; SalesCallRevenueAnalyzer/1.0)",
          },
        }
      );
      if (htmlRes.ok) {
        const html = await htmlRes.text();
        const regex = /items\.push\(\{[^}]*name:\s*"([^"]+)"[^}]*gid:\s*"([^"]+)"/g;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(html)) !== null) {
          tabMap.push({ name: m[1].trim(), gid: m[2].trim() });
        }
      }
    } catch (err) {
      console.warn("Could not inspect tabMap from htmlview:", err);
    }

    if (tabMap.length > 0) {
      // Concurrently fetch each discovered tab using the export?format=csv&gid=... endpoint
      // This endpoint has no caching delay and includes the latest changes (e.g. 13/09/2026) immediately
      const fetchPromises = tabMap.map(async ({ name, gid }) => {
        try {
          const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
          const res = await fetch(exportUrl, {
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; SalesCallRevenueAnalyzer/1.0)",
            },
          });
          if (res.ok) {
            const csvText = await res.text();
            if (name.toLowerCase().includes("anomal")) {
              const parsedAnomalies = parseAnomaliesCSV(csvText);
              return { type: "anomalies", anomalies: parsedAnomalies };
            } else if (csvText.trim().length > 30) {
              const rows = parseCSV(csvText);
              const records = parseCSVToSheetRecords(rows, undefined, name);
              if (records.length > 0) {
                return { type: "records", tab: name, records };
              }
            }
          }
        } catch (err) {
          console.warn(`Error fetching tab "${name}" via export:`, err);
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      for (const res of results) {
        if (!res) continue;
        if (res.type === "records" && res.records && res.records.length > 0) {
          allRecords.push(...res.records);
          discoveredTabs.push(res.tab!);
        } else if (res.type === "anomalies" && res.anomalies) {
          anomalies = res.anomalies;
        }
      }
    }

    // Attempt 2: Fallback to GVIZ CSV endpoint if htmlview tab discovery returned no records
    if (allRecords.length === 0) {
      const fallbackTabs = [
        "October",
        "September",
        "August",
        "July",
        "November",
        "December",
        "June",
        "May",
        "April",
        "March",
      ];
      const gvizPromises = fallbackTabs.map(async (tab) => {
        try {
          const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
            tab
          )}`;
          const gvizRes = await fetch(gvizUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; SalesCallRevenueAnalyzer/1.0)",
            },
          });
          if (gvizRes.ok) {
            const csvText = await gvizRes.text();
            if (csvText.trim().length > 30 && !csvText.includes("INVALID_SHEET_NAME")) {
              const rows = parseCSV(csvText);
              const records = parseCSVToSheetRecords(rows, undefined, tab);
              if (records.length > 0) {
                return { tab, records };
              }
            }
          }
        } catch (err) {
          console.warn(`Error in GVIZ fallback for "${tab}":`, err);
        }
        return null;
      });

      const gvizResults = await Promise.all(gvizPromises);
      for (const res of gvizResults) {
        if (res && res.records.length > 0) {
          allRecords.push(...res.records);
          discoveredTabs.push(res.tab);
        }
      }
    }

    // If anomalies not yet discovered, fetch Anomalies tab via GVIZ
    if (anomalies.length === 0) {
      try {
        const anomaliesGviz = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Anomalies`;
        const anomRes = await fetch(anomaliesGviz, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; SalesCallRevenueAnalyzer/1.0)",
          },
        });
        if (anomRes.ok) {
          const anomText = await anomRes.text();
          if (
            anomText.trim().length > 10 &&
            !anomText.includes("INVALID_SHEET_NAME") &&
            !anomText.includes("<html>")
          ) {
            anomalies = parseAnomaliesCSV(anomText);
          }
        }
      } catch (e) {
        console.warn("Could not fetch Anomalies subsheet via GVIZ:", e);
      }
    }

    allRecords.sort((a, b) => a.date.localeCompare(b.date));
    if (allRecords.length > 0) {
      cachedSheetRecords = allRecords;
    }
    if (anomalies.length > 0) {
      cachedAnomalies = anomalies;
    }

    return { records: allRecords, tabs: discoveredTabs, anomalies };
  }

  // Warm up the cache in background on server boot
  fetchSheetRecords().catch((e) => console.warn("Background sheet warmup:", e.message));

  app.use(express.json({ limit: "10mb" }));

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Google Sheet Data proxy endpoint with automatic multi-subsheet discovery
  app.get("/api/sheet-data", async (req, res) => {
    try {
      const sheetUrl = (req.query.url as string) || undefined;
      const { records, tabs, anomalies } = await fetchSheetRecords(sheetUrl);

      return res.json({
        success: true,
        records,
        tabs,
        anomalies,
        source: "multi_subsheet_sync",
        count: records.length,
        anomaliesCount: anomalies.length,
        syncedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal Server Error";
      console.error("Error fetching Google Sheet subsheets:", message);
      return res.status(500).json({ error: message });
    }
  });

  // Vite middleware for development vs static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
