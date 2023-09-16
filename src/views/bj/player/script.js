function elem(id) {
	return document.getElementById(id);
}

let url = location.href.split("?")[0];
let parts = url.split("/");
if (parts.pop() == "") parts.pop();
const baseUrl = parts.join("/");
const wsUrl = baseUrl.replace(/https?:/g, "ws:");

elem("gameKeyInput").value = new URLSearchParams(window.location.search).get(
	"g"
);

elem("gameInfoCont").style.display = "none";
elem("betCont").style.display = "none";
elem("betDisp").style.display = "none";

let PLAYER_STATE = {};

let SOCKET;

async function joinGame() {
	let name = elem("nameInput").value;
	let gameKey = elem("gameKeyInput").value;

	const response = await fetch(baseUrl + "/join/" + gameKey, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ name: name }),
	});
	let data = await response.json();
	console.log(data);

	SOCKET = new WebSocket(wsUrl + "/player/" + gameKey + "/" + data.key);

	// WebSocket event handlers
	SOCKET.addEventListener("open", (event) => {
		console.log("WebSocket connection opened:", event);

		elem("betCont").style.display = "unset";
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
				PLAYER_STATE = body.payload;
				renderGameInfo();
			}
		} else if (body.type == "ACTION") {
			if (body.msg == "PL_RES") {
				PLAYER_STATE = body.payload.player;
				renderGameInfo();

				elem("betDisp").style.display = "none";
				elem("betInp").style.display = "unset";

				elem(
					"lastRes"
				).innerText = `${body.payload.bet} x ${body.payload.multiplier} = ${body.payload.won}`;
			}
		}
	});
}
elem("joinGameButton").onclick = () => {
	elem("joinGameCont").style.display = "none";
	joinGame();
};
elem("placeBetButton").onclick = () => {
	let bet = Number(elem("betInput").value);
	let payload = { action: "PL_BET", payload: { bet: bet } };
	SOCKET.send(JSON.stringify(payload));
	elem("betInp").style.display = "none";
	elem("betDisp").style.display = "unset";
	elem("betDisp").innerText = bet;
};

function renderGameInfo() {
	console.log("renderGameInfo");
	elem("playerKey").innerText = PLAYER_STATE.key || "---";
	elem("minBet").innerText = PLAYER_STATE.minBet || "---";
	elem("balance").innerHTML = PLAYER_STATE.balance || "---";
	elem("currBet").innerText = PLAYER_STATE.currBet || "---";
	elem("playerName").innerText = PLAYER_STATE.name || "---";
}
