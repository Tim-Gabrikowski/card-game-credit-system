function elem(id) {
	return document.getElementById(id);
}

elem("gameInfoCont").style.display = "none";
elem("playerListCont").style.display = "none";

let GAME_STATE = {};

let SOCKET;

async function initGame() {
	let minBet = Number(elem("minBetInput").value);
	let startMoney = Number(elem("startMoneyInput").value);

	const response = await fetch(location.origin + "/blackjack/new-game", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ minBet: minBet, startMoney: startMoney }),
	});
	let data = await response.json();
	console.log(data);

	SOCKET = new WebSocket(
		"ws://" + location.host + "/blackjack/master/" + data.master.key
	);

	// WebSocket event handlers
	SOCKET.addEventListener("open", (event) => {
		console.log("WebSocket connection opened:", event);

		elem("playerListCont").style.display = "unset";
		elem("gameInfoCont").style.display = "unset";

		// socket.send('Hello, server!');
	});

	SOCKET.addEventListener("message", (event) => {
		let msgData = JSON.parse(event.data);
		if (msgData.status == "FAIL") return;

		console.log(msgData);

		let body = msgData.payload;

		if (body.type == "UPDATE") {
			if (body.msg == "GAME_STATE") {
				GAME_STATE = body.payload;
				renderGameInfo();
				renderPlayerList();
			}
		} else if (body.type == "ACTION") {
			if (body.msg == "MT_PJT") {
				GAME_STATE.players.push(body.payload);
				renderGameInfo();
				renderPlayerList();
			} else if (body.msg == "PL_BET") {
				let pi = GAME_STATE.players.findIndex(
					(p) => p.key == body.payload.pKey
				);
				GAME_STATE.players[pi].currBet = body.payload.bet;
				GAME_STATE.players[pi].balance = body.payload.balance;
				renderPlayerList();
			}
		}
	});
}
elem("createGameButton").onclick = () => {
	elem("createGameCont").style.display = "none";
	initGame();
};

function renderGameInfo() {
	console.log("renderGameInfo");
	elem("gameKey").innerText = GAME_STATE.key || "---";
	elem("minBet").innerText = GAME_STATE.minBet || "---";
	elem("startMoney").innerHTML = GAME_STATE.startMoney || "---";
	elem("playerCount").innerText = GAME_STATE.players.length || "---";
}

function renderPlayerList() {
	let playerString = [];
	for (let pi = 0; pi < GAME_STATE.players.length; pi++) {
		const p = GAME_STATE.players[pi];

		let ps = `
		<div class="player">
			<h2>${p.name}</h2>
			<p>${p.currBet || "---"}</p>
			<p>${p.balance}</p>
			<div class="btn_row">
				<button onclick="${
					p.currBet ? "sendPlayerResult('" + p.key + "', 0)" : ""
				}">x0.0</button>
				<button onclick="${
					p.currBet ? "sendPlayerResult('" + p.key + "', 2)" : ""
				}">x2.0</button>
				<button onclick="${
					p.currBet ? "sendPlayerResult('" + p.key + "', 2.5)" : ""
				}">x2.5</button>
			</div>
		</div>
		`;
		playerString.push(ps);
	}
	elem("playerList").innerHTML = playerString.join("");
}

function sendPlayerResult(pKey, mul) {
	let payl = {
		action: "MT_PRM",
		payload: { pKey: pKey, multiplier: mul },
	};
	SOCKET.send(JSON.stringify(payl));
}
