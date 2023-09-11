import { Router } from "express";
import { randomBytes } from "crypto";

const router = Router();

const MESSAGES = {
	master: {
		GET_STATE: "MT_GTS",
	},
	observer: {},
	player: {
		GET_STATE: "PL_GTS",
	},
	errors: {
		GAME_NOT_FOUND: "ERR_GNF",
		PLAYER_NOT_FOUND: "ERR_PNF",
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

router.post("/join/:key", (req, res) => {
	const gKey = req.params.key;

	let gi = GAMES.findIndex((g) => g.key == gKey);
	if (gi == -1)
		return res.status(404).send({
			status: MESSAGES.status.FAIL,
			error: MESSAGES.errors.GAME_NOT_FOUND,
		});

	let player = {
		key: randomBytes(4).toString("hex"),
		name: req.body.name || "Player #" + (GAMES[gi].players.length + 1),
		socket: null,
		balance: GAMES[gi].startMoney,
		currBet: 0,
	};
	GAMES[gi].players.push(player);

	res.send(player);
});

router.ws("/player/:gkey/:pkey", (soc, req) => {
	const gKey = req.params.gkey;
	const pKey = req.params.pkey;

	let gi = GAMES.findIndex((g) => g.key == gKey);

	if (gi == -1) {
		return soc.send(
			formSocResponse(
				MESSAGES.status.FAIL,
				{},
				MESSAGES.errors.GAME_NOT_FOUND
			)
		);
	}

	let pi = GAMES[gi].players.findIndex((p) => p.key == pKey);
	if (pi == -1) {
		return soc.send(
			formSocResponse(
				MESSAGES.status.FAIL,
				{},
				MESSAGES.errors.PLAYER_NOT_FOUND
			)
		);
	}
	soc.send(formSocResponse(MESSAGES.status.OK, GAMES[gi].players[pi]));
	GAMES[gi].players[pi].socket = soc;
	soc.on("message", (msg) => {
		onMasterSocketRequest(mKey, msg, (cb_msg) => {
			soc.send(cb_msg);
		});
	});
});

router.ws("/master/:key", (soc, req) => {
	let mKey = req.params.key;

	let gi = GAMES.findIndex((g) => g.master.key == mKey);

	if (gi == -1) {
		return soc.send(
			formSocResponse(
				MESSAGES.status.FAIL,
				{},
				MESSAGES.errors.GAME_NOT_FOUND
			)
		);
	}

	soc.send(formSocResponse(MESSAGES.status.OK, GAMES[gi]));
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

function onPlayerSocketRequest(pKey, gKey, msg, callback) {
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

	let gi = GAMES.findIndex((g) => g.key == gKey);
	let pi = GAMES[gi].players.findIndex((p) => p.key == pKey);

	switch (req.action) {
		case MESSAGES.player.GET_STATE:
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
