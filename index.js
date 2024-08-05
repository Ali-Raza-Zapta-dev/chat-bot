import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEYS);

app.get("/api/chat-bot", async (req, res, next) => {
  const prompt = req.query.prompt;
  genTextStream(prompt, res);
});

async function genTextStream(prompt, res) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const result = await model.generateContentStream([prompt]);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      res.write(`data: ${text}\n\n`);
    }

    // Signal the end of the stream
    res.write("event: end\n\n");
    res.end();
  } catch (error) {
    res.write(`event: error\ndata: ${error.message}\n\n`);
    res.end();
  }
}

app.listen(process.env.PORT, () => {
  console.log(`SERVER IS RUNNING ON PORT--:${process.env.PORT}`);
});
