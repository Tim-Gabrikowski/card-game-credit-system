import "dotenv/config";
import cors from "cors";
import express from "express";

import * as logger from "./logger.js";

const app = express();

import expressWs from "express-ws";
expressWs(app);

app.use(express.json());

app.use(cors());

import { blackjackRouter } from "./router/bj.js";
app.use("/blackjack", blackjackRouter);

app.listen(process.env.PORT, () =>
	logger.info("MAIN", `Example app listening on port ${process.env.PORT}!`)
);

process.on("uncaughtException", (err) => {
	logger.critical("MAIN", err);
});
