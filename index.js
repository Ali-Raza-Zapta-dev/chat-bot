
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import multer from "multer";
import fs from "fs";
import path from "path";

import { URL } from "node:url"; // in Browser, the URL in native accessible on window

const __filename = new URL("", import.meta.url).pathname;
// Will contain trailing slash
const __dirname = new URL(".", import.meta.url).pathname;

import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEYS);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const conversationContexts = {};


function fileToGenerativePart(file) {
  if (file.mimetype.startsWith("text/")) {
    return {
      inlineData: {
        data: file.buffer.toString("utf-8"),
        mimeType: file.mimetype,
      },
    };
  } else {
    return {
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: file.mimetype,
      },
    };
  }
}

app.post("/api/chat-bot", upload.single("file"), async (req, res, next) => {
  const prompt = req.body.content;
  const sessionId = req.body.sessionId || "user-1";
  const file = req.file;

  if (!sessionId) {
    return res.status(400).send({ error: "Session ID is required" });
  }

  if (!conversationContexts[sessionId]) {
    conversationContexts[sessionId] = [];
  }

  if (file) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const fileContent = file.buffer.toString("utf-8");
      conversationContexts[sessionId].push(
        `User's file content: ${fileContent}`
      );
      const filePart = fileToGenerativePart(file.buffer, file.mimetype);

      const result = await model.generateContentStream([prompt, filePart], {
        temperature: 0.7,
        top_p: 0.9,
      });

      for await (const chunk of result?.stream) {
        const text = chunk?.text();
        conversationContexts[sessionId].push(`AI: ${text}`);
        res.write(`data: ${text}\n\n`);
      }
      res.write("event: end\n\n");
      res.end();
    } catch (error) {
      console.log("new error------");
      throw new Error(error);
    }
  } else {
    conversationContexts[sessionId].push(`User: ${prompt}`);
    try {
      await genTextStream(sessionId, prompt, res);
    } catch (error) {
      console.log("ERRRRRRRRRRRRRRRRRRRRRRR");
      next(new Error(error));
    }
  }
});

app.get("/api/chat-bot", async (req, res, next) => {
  const prompt = req.query.prompt;
  const chatId = req.query.chatId || "user-1";

  if (!chatId) {
    return res.status(400).send({ error: "Session ID is required" });
  }

  // Generate the response stream with context
  await genTextStream(chatId, prompt, res);
});

async function genTextStream(chatId, prompt, res) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Initialize or update the conversation context
  if (!conversationContexts[chatId]) {
    conversationContexts[chatId] = [];
  }
  conversationContexts[chatId].push(`User: ${prompt}`);

  try {
    // Generate the response with the conversation context
    const context = conversationContexts[chatId].join("\n");
    let result;
    try {
      result = await model.generateContentStream([context], {
        temperature: 0.7,
        top_p: 0.9,
      });
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }

    for await (const chunk of result.stream) {
      const text = chunk.text();
      // console.log(text);
      conversationContexts[chatId].push(`AI: ${text}`);
      res.write(`data: ${text}\n\n`);
    }

    // Signal the end of the stream
    res.write("event: end\n\n");
    res.end();
  } catch (error) {
    res.write(`event: error\ndata: ${error.message}\n\n`);
    res.end();
    throw new Error(error);
  }
}

// Optionally, you can add a route to reset the conversation context
app.post("/api/reset-context", (req, res) => {
  const sessionId = req.body.sessionId;
  if (sessionId && conversationContexts[sessionId]) {
    delete conversationContexts[sessionId];
    res.send({ message: "Context reset successfully" });
  } else {
    res.status(400).send({ error: "Invalid session ID" });
  }
});

app.use((err, req, res, next) => {
  const message = err?.message || "something went wrong.";
  res.status(500).json({
    message,
  });
});

app.listen(process.env.PORT, () => {
  console.log(`SERVER IS RUNNING ON PORT--:${process.env.PORT}`);
});
