import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI("AIzaSyBWE0DQtN9spxx63JSFBjE17hfrD4ikaic");

app.get("/api/chat-bot", async (req, res, next) => {
  const prompt = req.query.prompt;
  genTextV2(prompt,res);
});


async function genTextV2(prompt, res) {
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
  console.log(`SERVER IS RUNNING ON PORT:${process.env.PORT}`);
});

async function run(prompt) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { maxOutputTokens: 2000, temperature: 0.9 },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  return text;
}
