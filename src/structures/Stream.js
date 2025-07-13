import Base from "./Base.js";
import Game from "./Game.js";
import User from "./User.js";

export default class Stream extends Base {
	#thumbTemplate = null;
	broadcaster = null;
	channelId = null;
	createdAt = new Date();
	createdTimestamp = Date.now();
	id = null;
	language = null;
	mature = false;
	title = null;
	viewers = 0;
	game = new Game();

	get createdAgo() {
		return Date.now() - this.createdAt;
	}

	/**
	 * 
	 * @param {Client} client 
	 * @param {Object} message 
	 */
	constructor(client, data = {}) {
		super(client);

		Object.defineProperty(this, 'channel', { value: null, writable: true });

		this.broadcaster = new User(client, data);
		this.createdAt = new Date(data.started_at);
		this.createdTimestamp = this.createdAt.getTime();
		this.game = new Game(client, data);
		this.id = data.id;
		this.language = data.language;
		this.mature = data.is_mature;
		this.title = data.title;
		this.#thumbTemplate = data.thumbnail_url;
		// data.tag_ids;
	}

	thumbnailURL(width = 1920, height = 1080) {
		return this.#thumbTemplate
			.replace('{width}', width)
			.replace('{height}', height);
	}
}