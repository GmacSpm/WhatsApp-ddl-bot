export function parseConfigCommand(message) {
	const match = message.trim().match(/^(set|get|reset)\s+([a-zA-Z][\w-]*)(?:\s+(.+))?$/i);
	if (!match) {
		return null;
	}
	const [, command, key, value] = match;
	return {
		command: command.toLowerCase(),
		key: key.toLowerCase(),
		value: value?.trim() ?? "",
	};
}

export function isConfigCommand(message) {
	if (typeof message !== "string") {
		return false;
	}
	const command = message.trim().split(/\s+/, 1)[0].toLowerCase();
	return command === "set" ||
	       command === "get" ||
	       command === "reset";
}