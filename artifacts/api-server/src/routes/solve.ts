import { Router, type IRouter } from "express";
import { SolveAlgebraBody, SolveAlgebraResponse } from "@workspace/api-zod";
import { spawn } from "node:child_process";
import path from "node:path";

const router: IRouter = Router();

type MathpixResponse = {
  text?: string;
  error?: string;
  error_info?: { id?: string; message?: string };
};

type PythonResult = {
  mode: "text" | "image";
  rawText: string;
  latex: string;
  equation: string;
  variable: string;
  solution: string;
  steps: Array<{ label: string; expression: string; detail: string }>;
};

function extractLatexEquation(rawText: string): string {
  const dollarMatch = rawText.match(/\$(.+?)\$/s);
  if (dollarMatch?.[1]) return dollarMatch[1].trim();

  const bracketMatch = rawText.match(/\\\[(.+?)\\\]/s);
  if (bracketMatch?.[1]) return bracketMatch[1].trim();

  const inlineMatch = rawText.match(/\\\((.+?)\\\)/s);
  if (inlineMatch?.[1]) return inlineMatch[1].trim();

  return rawText.trim();
}

async function imageToLatex(imageBase64: string, mimeType: string) {
  const appId = process.env.MATHPIX_APP_ID;
  const appKey = process.env.MATHPIX_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Mathpix credentials are not configured.");
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([Buffer.from(imageBase64, "base64")], { type: mimeType }),
    "equation-image",
  );
  form.append(
    "options_json",
    JSON.stringify({
      math_inline_delimiters: ["$", "$"],
      rm_spaces: true,
    }),
  );

  const response = await fetch("https://api.mathpix.com/v3/text", {
    method: "POST",
    headers: { app_id: appId, app_key: appKey },
    body: form,
  });
  const result = (await response.json()) as MathpixResponse;

  if (!response.ok) {
    const message =
      result.error_info?.message ?? result.error ?? "Mathpix OCR failed.";
    throw new Error(message);
  }
  if (!result.text) {
    throw new Error("Mathpix did not recognize an equation in that image.");
  }

  return { rawText: result.text, latex: extractLatexEquation(result.text) };
}

function runPythonSolver(input: {
  mode: "text" | "image";
  rawText: string;
  latex: string;
}): Promise<PythonResult> {
  const scriptPath = path.join(__dirname, "python", "algebra_solver.py");

  return new Promise((resolve, reject) => {
    const process = spawn("python3", [scriptPath]);
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    process.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    process.on("error", (error) => {
      reject(new Error(`Unable to start the SymPy solver: ${error.message}`));
    });
    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "SymPy could not solve that equation."));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as PythonResult);
      } catch {
        reject(new Error("The SymPy solver returned an invalid response."));
      }
    });

    process.stdin.end(JSON.stringify(input));
  });
}

router.post("/solve", async (req, res) => {
  const parsed = SolveAlgebraBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide an equation or an equation image." });
    return;
  }

  const { mode } = parsed.data;
  try {
    let rawText = parsed.data.equation?.trim() ?? "";
    let latex = rawText;

    if (mode === "image") {
      if (!parsed.data.imageBase64) {
        res.status(400).json({ error: "An image is required for OCR mode." });
        return;
      }

      const ocr = await imageToLatex(
        parsed.data.imageBase64,
        parsed.data.mimeType ?? "image/jpeg",
      );
      rawText = ocr.rawText;
      latex = ocr.latex;
    }

    if (!latex) {
      res.status(400).json({ error: "Enter an equation to solve." });
      return;
    }

    req.log.info({ mode }, "Solving algebra equation");
    const result = await runPythonSolver({ mode, rawText, latex });
    res.json(SolveAlgebraResponse.parse(result));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to solve equation.";
    req.log.warn({ err: error, mode }, "Algebra solve failed");
    res.status(500).json({ error: message });
  }
});

export default router;