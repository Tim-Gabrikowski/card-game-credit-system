import { Router } from "express";
import { randomBytes } from "crypto";

const router = Router();

const MESSAGES = {
	master: {
		GET_STATE: "MT_GTS",
		PLAYER_LOST_RESULT: "MT_PLR",
		PLAYER_WON_RESULT: "MT_PLW",
	},
	observer: {},
	player: {
		POST_BET: "PL_BET",
		LOST: "PL_LST",
		WON: "PL_WON",
	},
	errors: {
		GAME_NOT_FOUND: "ERR_GNF",
		PLAYER_NOT_FOUND: "ERR_PNF",
		CLIEND_FAIL: "ERR_CFR",
		UNKNOWN_ACTION: "ERR_NVA",
		PL_NE_MONEY: "ERR_PNEM",
		PL_LOW_BET: "ERR_PTLB",
	},
	status: {
		OK: "OKAY",
		FAIL: "FAIL",
		DONE: "DONE",
		BRDC: "BRDC",
	},
};

import expressWs from "express-ws";
expressWs(router);

let GAMES = [];
let SOCKETS = [];

router.post("/new-game", (req, res) => {
	console.log(req.body);
	const { minBet, startMoney } = req.body;

	let game = {
		key: randomBytes(8).toString("hex"),
		minBet: minBet,
		startMoney: startMoney,
		master: {
			key: randomBytes(8).toString("hex"),
		},
		observer: {
			key: randomBytes(8).toString("hex"),
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
	SOCKETS.push({ gKey: gKey, socket: soc, type: "PLAYER", pKey: pKey });
	soc.on("message", (msg) => {
		onPlayerSocketRequest(pKey, gKey, msg, (cb_msg) => {
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
	SOCKETS.push({
		gKey: GAMES[gi].key,
		socket: soc,
		type: "MASTER",
		mKey: mKey,
	});
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
	let pi, pKey;

	switch (req.action) {
		case MESSAGES.master.GET_STATE:
			callback(formSocResponse(MESSAGES.status.OK, GAMES[gi]));
			break;
		case MESSAGES.master.PLAYER_LOST_RESULT:
			pKey = req.payload.pKey;
			pi = GAMES[gi].players.findIndex((p) => p.key == pKey);
			GAMES[gi].players[pi].currBet = 0;
			socketSendPlayer(gKey, pKey, {
				type: "ACTION",
				msg: "PL_LST",
				payload: GAMES[gi].players[pi],
			});
			break;
		case MESSAGES.master.PLAYER_WON_RESULT:
			pKey = req.payload.pKey;
			pi = GAMES[gi].players.findIndex((p) => p.key == pKey);

			GAMES[gi].players[pi].currBet +=
				GAMES[gi].players[pi].currBet * req.payload.multiplier;
			socketSendPlayer(gKey, pKey, {
				type: "ACTION",
				msg: "PL_WON",
				payload: GAMES[gi].players[pi],
			});
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
		case MESSAGES.player.POST_BET:
			if (GAMES[gi].players[pi].balance < req.payload.bet) {
				return callback(
					formSocResponse(
						MESSAGES.status.FAIL,
						{},
						MESSAGES.errors.PL_NE_MONEY
					)
				);
			}
			if (req.payload.bet < GAMES[gi].minBet) {
				return callback(
					formSocResponse(
						MESSAGES.status.FAIL,
						{},
						MESSAGES.errors.PL_LOW_BET
					)
				);
			}
			GAMES[gi].players[pi].currBet = req.payload.bet;
			GAMES[gi].players[pi].balance -= req.payload.bet;
			socketSendMaster(gKey, {
				type: "ACTION",
				msg: "PL_BET",
				payload: { pKey: pKey, bet: req.payload.bet },
			});
			callback(
				formSocResponse(MESSAGES.status.OK, GAMES[gi].players[pi])
			);
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

function socketSendMaster(gKey, payload) {
	let si = SOCKETS.findIndex((s) => s.gKey == gKey && s.type == "MASTER");
	SOCKETS[si].socket.send(formSocResponse(MESSAGES.status.BRDC, payload));
}

function socketSendPlayer(gKey, pKey, payload) {
	let si = SOCKETS.findIndex(
		(s) => s.gKey == gKey && s.type == "PLAYER" && pKey == pKey
	);
	SOCKETS[si].socket.send(formSocResponse(MESSAGES.status.BRDC, payload));
}
