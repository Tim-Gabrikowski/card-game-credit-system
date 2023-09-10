import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function info(origin, message) {
	let output = `[ INFO    ] ${timeDateString()} [ ${origin} ]: ${message}`;
	let colorOutput = `[\x1b[32m INFO     \x1b[0m] \x1b[90m${timeDateString()} \x1b[0m[\x1b[34m ${origin} \x1b[0m]: ${message}\x1b[0m`;
	console.log(colorOutput);
	writeToFile(output);
}
export function debug(origin, message) {
	if (process.argv.includes("--debug")) {
		let output = `[ DEBUG   ] ${timeDateString()} [ ${origin} ]: ${message}`;
		let colorOutput = `[\x1b[34m DEBUG    \x1b[0m] \x1b[90m${timeDateString()} \x1b[0m[\x1b[34m ${origin} \x1b[0m]: ${message}\x1b[0m`;
		console.log(colorOutput);
		writeToFile(output);
	}
}
export function error(origin, message) {
	let output = `[ ERROR   ] ${timeDateString()} [ ${origin} ]: ${message}`;
	let colorOutput = `[\x1b[31m ERROR    \x1b[0m] \x1b[90m${timeDateString()} \x1b[0m[\x1b[34m ${origin} \x1b[0m]: ${message}\x1b[0m`;
	console.log(colorOutput);
	writeToFile(output);
}
export function critical(origin, message) {
	let output = `[ CRITICAL ] ${timeDateString()} [ ${origin} ]: ${message}`;
	let colorOutput = `[\x1b[35m CRITICAL \x1b[0m] \x1b[90m${timeDateString()} \x1b[0m[\x1b[34m ${origin} \x1b[0m]: ${message}\x1b[0m`;
	console.log(colorOutput);
	writeToFile(output);
}

function timeDateString() {
	let date_ob = new Date();
	let date = ("0" + date_ob.getDate()).slice(-2);
	let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
	let year = date_ob.getFullYear();
	let hours = ("0" + (date_ob.getHours() + 1)).slice(-2);
	let minutes = ("0" + (date_ob.getMinutes() + 1)).slice(-2);
	let seconds = ("0" + (date_ob.getSeconds() + 1)).slice(-2);
	return (
		year +
		"." +
		month +
		"." +
		date +
		" " +
		hours +
		":" +
		minutes +
		":" +
		seconds
	);
}
function dateString() {
	let date_ob = new Date();
	let date = ("0" + date_ob.getDate()).slice(-2);
	let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
	let year = date_ob.getFullYear();
	return year + "-" + month + "-" + date;
}

let stream = fs.createWriteStream(
	path.join(__dirname, "../logs/log-" + dateString() + ".log"),
	{ flags: "a" }
);
let lastOpenDate = dateString();
if (!fs.existsSync(path.join(__dirname, "../logs"))) {
	fs.mkdirSync(path.join(__dirname, "../logs"));
}

function writeToFile(logMessage) {
	if (dateString() !== lastOpenDate) {
		stream.close();
		lastOpenDate = dateString();
		stream = fs.createWriteStream(
			path.join(__dirname, "../logs/log-" + dateString() + ".log"),
			{ flags: "a" }
		);
	}
	stream.write(logMessage + "\n");
}
