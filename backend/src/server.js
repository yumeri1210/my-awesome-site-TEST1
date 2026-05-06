import express from "express";
import cors from "cors";
import { config } from "./config.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
});
