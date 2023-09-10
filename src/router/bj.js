import { Router } from "express";
import { randomBytes } from "crypto";

const router = Router();

const MESSAGES = {
	master: {
		GET_STATE: "GET_STATE",
	},
	observer: {},
	player: {},
	errors: {
		GAME_NOT_FOUND: "ERR_GNF",
		CLIEND_FAIL: "ERR_CFR",
		UNKNOWN_ACTION: "ERR_NVA",
	},
	status: {
		OK: "OK",
		FAIL: "FAIL",
		DONE: "DONE",
	},
};

import expressWs from "express-ws";
expressWs(router);

let GAMES = [];

router.post("/new-game", (req, res) => {
	console.log(req.body);
	const { minBet, startMoney } = req.body;

	let game = {
		key: randomBytes(8).toString("hex"),
		minBet: minBet,
		startMoney: startMoney,
		master: {
			key: randomBytes(8).toString("hex"),
			socket: null,
		},
		observer: {
			key: randomBytes(8).toString("hex"),
			socket: null,
		},
		players: [],
	};
	GAMES.push(game);
	res.send(game);
});

router.ws("/master/:key", (soc, req) => {
	let mKey = req.params.key;

	let gi = GAMES.findIndex((g) => g.master.key == mKey);

	if (gi == -1) return soc.send('{"error":"not found"}');

	soc.send(JSON.stringify(GAMES[gi]));
	GAMES[gi].master.socket = soc;
	soc.on("message", (msg) => {
		onMasterSocketRequest(mKey, msg, (cb_msg) => {
			soc.send(cb_msg);
		});
	});
});

export const blackjackRouter = router;

function onMasterSocketRequest(mKey, msg, callback) {
	let req = {};
	try {
		req = JSON.parse(msg);
	} catch (e) {
		return callback("not understanding");
	}
	if (req.action == null || req.action == undefined) {
		return callback(
			JSON.stringify({
				status: MESSAGES.status.FAIL,
				error: MESSAGES.errors.CLIEND_FAIL,
			})
		);
	}

	let gi = GAMES.findIndex((g) => g.master.key == mKey);

	switch (req.action) {
		case MESSAGES.master.GET_STATE:
			callback(formSocResponse(MESSAGES.status.OK, GAMES[gi]));
			break;
		default:
			callback(
				formSocResponse(
					MESSAGES.status.FAIL,
					{},
					MESSAGES.errors.UNKNOWN_ACTION
				)
			);
			break;
	}
}

function formSocResponse(status, payload, error) {
	return JSON.stringify({
		status,
		error,
		payload,
	});
}
