import Base from "./Base.js";

export default class User extends Base {
	#avatarURL = null;
	id = null;
	username = null;
	displayName = null;
	color = null;
	badges = new Set();

	/**
	 * 
	 * @param {Client} client
	 * @param {object} data
	 */
	constructor(client, data = {}) {
		super(client);
		this._patch(data);

		if (this.username !== null) {
			if (this.client.users.cache.has(this.username)) {
				const user = this.client.users.cache.get(this.username);
				user._patch(data);
				return user;
			}

			this.client.users.cache.set(this.username, this);
		}
	}

	_patch(data) {
		const { tags, source } = data;
		if (typeof tags == "object" && tags !== null) {
			tags.login && (this.username = tags.login);
			tags.color && (this.color = tags.color || this.color);
			tags.subscriber && (this.subscriber = tags.subscriber ?? this.subscriber);
			if ("user-id" in tags) {
				this.id = tags["user-id"] || this.id;
			}

			if ("display-name" in tags) {
				this.displayName = tags["display-name"] || this.displayName;
				this.username = (this.displayName && this.displayName.toLowerCase()) || this.username;
			}

			if (("user-type" in tags) || tags.mod) {
				this.moderator = !!tags.mod || tags["user-type"] == "mod";
			}

			if ("first-msg" in tags) {
				this.firstMessage = tags["first-msg"] ?? this.firstMessage;
			}

			if (typeof tags.badges === "object" && tags.badges !== null) {
				this.badges = new Set(Object.keys(tags.badges));
			}
		}

		if (typeof source == "object" && source !== null) {
			this.username = source.nick ?? this.username;
		}

		if ('user_id' in data) {
			this.id = data.user_id;
			this.username = data.login || data.user_login;
			if ('user_name' in data) {
				this.displayName = data.user_name;
			}
		}
	}

	avatarURL({ force } = {}) {
		if (!force && this.#avatarURL !== null)
			return this.#avatarURL;

		return this.client.api(`/users?id=${this.id}`).then(([data] = []) => {
			if (data !== void 0) return this.#avatarURL = data.profile_image_url;
			return this.#avatarURL;
		});
	}

	/**
	 * 
	 * @param {String} channel 
	 * @param {String} reason 
	 * @returns {Promise}
	 */
	ban(channel, reason) {
		if (this.client.user.username === this.username)
			throw new Error("You cannot ban yourself.");

		return this.client.ban(channel, this.username, reason);
	}

	/**
	 * 
	 * @param {String} channel 
	 * @returns {Promise}
	 */
	host(channel) {
		return this.client.host(this.username, channel);
	}

	timeout(channel) {
		if (this.client.user.username === this.username)
			throw new Error("You cannot timeout yourself.");

		throw new RangeError('Not implemented');

		return this.client.timeout(channel.name || channel, this.username, channel);
	}

	whisper(message) {
		return this.client.whisper(this.id, message.content || message);
	}
}