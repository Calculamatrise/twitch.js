export default class TwitchAPIError extends Error {
	code = null;
	constructor(message, options) {
		super(message);

		for (const key in options) {
			switch (key) {
			case 'code':
				this[key] = options[key];
			}
		}
	}
}