import Base from "./Base.js";
import Stream from "./Stream.js";

const modifiers = new Set([
	"EMOTES_ONLY",
	"FOLLOWERS_ONLY",
	"R9K_MODE",
	"SLOW_MODE",
	"SUBSCRIBERS_ONLY"
]);

export default class Channel extends Base {
	id = null;
	name = null;
	slowDelay = 0;
	streaming = false;
	modifierDuration = 0;
	moderators = new Set();
	modifiers = new Set();
	stream = null;
	vips = new Set();

	/**
	 * 
	 * @param {Client} client 
	 * @param {Object} data 
	 */
	constructor(client, data = {}) {
		super(client);
		this._patch(data);

		if (this.name !== null) {
			if (this.client.channels.cache.has(this.name)) {
				const channel = this.client.channels.cache.get(this.name);
				channel._patch(data);
				return channel;
			}

			this.client.channels.cache.set(this.name, this);
		}
	}

	_patch(data) {
		const { tags, command } = data;
		if (typeof tags == "object" && tags !== null) {
			this.id = tags["room-id"] ?? this.id;
			if (tags["emote-only"] > 0) {
				this.modifiers.add("EMOTES_ONLY");
			}

			if (tags['followers-only'] > -1) {
				this.modifierDuration = ~~tags["followers-only"];
				this.modifiers.add("FOLLOWERS_ONLY");
			}

			if (tags.r9k > 0) {
				this.modifiers.add("R9K_MODE");
			}

			if (tags.slow > 0) {
				this.slowDelay = ~~tags.slow;
				this.modifiers.add("SLOW_MODE");
			}

			if (tags["subs-only"] > 0) {
				this.modifiers.add("SUBSCRIBERS_ONLY");
			}

			if (typeof tags.moderators === "object" && tags.moderators !== null) {
				this.moderators = new Set(Object.keys(tags.moderators));
			}

			if (typeof tags.vips === "object" && tags.vips !== null) {
				this.vips = new Set(Object.keys(tags.vips));
			}
		}

		if (typeof command == "object" && command !== null) {
			this.name = (command.channel && command.channel.replace(/^#?/, '#')) ?? this.name;
		}

		if ('broadcaster_id' in data) {
			this.id = data.broadcaster_id;
			this.name = `#${data.broadcaster_login}`;
			// data.broadcaster_name
			// this.#stream.delay = data.delay;
			// this.#stream.game.id = data.game_id;
			// this.#stream.game.name = data.game_name;
			// this.#stream.language = data.language;
			// this.#stream.title = data.title;
		}
	}

	/**
	 * 
	 * @async
	 * @param {String} modifier 
	 * @param {Number} duration duration in minutes
	 * @returns {Number?}
	 */
	async addModifier(modifier, duration) {
		if (!modifiers.has(modifier)) {
			throw new TypeError(`Modifier must be one of the following values: ${Array.from(modifiers.values()).join(", ")}`);
		}

		// https://dev.twitch.tv/docs/api/reference/#update-chat-settings
		if (!this.modifiers.has(modifier)) {
			switch (modifier) {
				case "EMOTES_ONLY": {
					await this.client.irc.sendCommand('/emoteonly', { channel: this.name });
					return this.client.irc.promise(({ tags }) => ~~tags?.['emote-only'] > 0);
				}

				case "R9K_MODE": {
					await this.client.irc.sendCommand('/r9kbeta', { channel: this.name });
					return this.client.irc.promise(({ tags }) => ~~tags?.['r9k'] > 0);
				}

				case "SLOW_MODE": {
					await this.client.irc.sendCommand('/slow', { channel: this.name });
					return this.client.irc.promise(({ tags }) => ~~tags?.['slow'] > 0);
				}

				case "SUBSCRIBERS_ONLY": {
					await this.client.irc.sendCommand('/subscribers', { channel: this.name });
					return this.client.irc.promise(({ tags }) => ~~tags?.['subs-only'] > 0);
				}
			}
		}

		if (modifier === 'FOLLOWERS_ONLY') {
			duration = duration ?? 30;
			await this.client.irc.sendCommand(`/followers ${duration}`, { channel: this.name });
			return this.client.irc.promise(({ tags }) => ~~tags?.['followers-only'] !== -1);
		}

		return this;
	}

	/**
	 * 
	 * @async
	 * @param {String} modifier 
	 * @returns {Number?}
	 */
	async removeModifier(modifier) {
		if (!modifiers.has(modifier)) {
			throw new TypeError(`Modifier must be one of the following values: ${Array.from(modifiers.values()).join(", ")}`);
		}

		if (this.modifiers.has(modifier)) {
			switch (modifier) {
			case "EMOTES_ONLY":
				await this.client.irc.sendCommand('/emoteonlyoff', { channel: this.name });
				return this.client.irc.promise(message => message.tags?.['emote-only'] == 0);
			case "FOLLOWERS_ONLY":
				await this.client.irc.sendCommand('/followersoff', { channel: this.name });
				return this.client.irc.promise(message => ~~message.tags?.['followers-only'] === -1);
			case "R9K_MODE":
				await this.client.irc.sendCommand('/r9kbetaoff', { channel: this.name });
				return this.client.irc.promise(message => message.tags?.['r9k'] == 0);
			case "SLOW_MODE":
				await this.client.irc.sendCommand('/slowoff', { channel: this.name });
				return this.client.irc.promise(message => message.tags?.['slow'] == 0);
			case "SUBSCRIBERS_ONLY":
				await this.client.irc.sendCommand('/subscribersoff', { channel: this.name });
				return this.client.irc.promise(message => message.tags?.['subs-only'] == 0);
			}
		}

		return this;
	}

	/**
	 * 
	 * @param {String} message 
	 * @returns {Promise<String>}
	 */
	announce(message) {
		return this.client.announce(message, this.name);
	}

	/**
	 * 
	 * @param {String} user user to ban
	 * @param {String} reason reason for ban
	 * @returns {Promise}
	 */
	ban(user, reason) {
		return this.client.ban(user, reason, this.name);
	}

	clear() {
		return this.client.clear(this.name);
	}

	/**
	 * 
	 * @param {Number} duration > duration in seconds
	 * @returns {Promise}
	 */
	commercial(duration) {
		return this.client.commercial(duration, this.name);
	}

	/**
	 * 
	 * @param {string} id
	 * @returns {Promise<unknown>}
	 */
	deleteMessage(id) {
		return this.client.deleteMessage(id, this.name);
	}

	/**
	 * 
	 * @param {object} [options]
	 * @param {boolean} [options.force]
	 * @returns {Promise<Stream>}
	 */
	async fetchStream({ force } = {}) {
		if (!force && this.stream !== null)
			return this.stream;

		return this.client.api(`/streams?user_login=${this.name.replace(/^#/, '')}`).then(data => {
			if (this.streaming = data.length > 0) {
				this.stream = new Stream(this.client, data.at(0));
				this.stream.channel = this;
				this.stream.channelId = this.id;
			}

			return this.stream;
		});
	}

	/**
	 * 
	 * @param {String} user 
	 * @returns {Promise}
	 */
	host(user) {
		return this.client.host(user, this.name);
	}

	/**
	 * 
	 * @param {String} description 
	 * @returns {Promise}
	 */
	marker(description) {
		return this.client.marker(description, this.name);
	}

	/**
	 * Mod a user
	 * @param {String} user 
	 * @returns {Promise} 
	 */
	async mod(user) {
		user = user.username || user;
		if (this.moderators.has(user)) {
			throw new Error(`${user} is already a moderator of this channel.`);
		}

		return this.client.mod(user, this.name);
	}

	async mods() {
		const mods = await this.client.mods(this.name);
		for (const mod of mods) {
			if (mod === 'There are no moderators of this channel.') {
				return this.moderators;
			}

			this.moderators.add(mod);
		}
		return this.moderators;
	}

	part() {
		return this.client.part(this.name);
	}

	/**
	 * 
	 * @param {(string|object)} data
	 * @param {object} [options]
	 * @param {boolean} [options.ephemeral]
	 * @param {string} [options.referenceId]
	 * @param {boolean} [options.sourceOnly]
	 * @returns {Promise}
	 */
	send(data, options = {}) {
		return this.client.sendMessage(this.id, data, options);
	}

	/**
	 * 
	 * @param {String} user 
	 * @param {Number} duration duration in seconds
	 * @param {String} [reason] reason for timeout
	 */
	timeout(user, duration, reason = '') {
		return this.client.timeout(user, duration, reason, this.name);
	}

	/**
	 * 
	 * @param {String} user 
	 * @returns {Promise}
	 */
	unban(user) {
		return this.client.unban(user, this.name);
	}

	unhost() {
		return this.client.unhost(this.name);
	}

	/**
	 * 
	 * @param {String} user 
	 * @returns {Promise}
	 */
	unmod(user) {
		return this.client.unmod(user);
	}

	/**
	 * 
	 * @param {String} user 
	 * @returns {Promise}
	 */
	unraid(user) {
		return this.client.unraid(user, this.name);
	}

	/**
	 * 
	 * @param {String} user 
	 * @returns {Promise}
	 */
	untimeout(user) {
		return this.client.untimeout(user, this.name);
	}

	/**
	 * Deem a user unworthy of VIP
	 * @param {String} user 
	 * @returns {Promise}
	 */
	unvip(user) {
		return this.client.unvip(user, this.name);
	}

	/**
	 * Deem a user worthy of VIP
	 * @param {String} user 
	 * @returns {Promise}
	 */
	vip(user) {
		return this.client.vip(user, this.name);
	}

	async getVips() {
		const vips = await this.client.vips(this.name);
		for (const vip of vips) {
			if (vip === 'This channel does not have any VIPs.') {
				return this.vips;
			}

			this.vips.add(vip);
		}
		return this.vips;
	}
}