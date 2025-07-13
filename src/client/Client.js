import BaseClient from "./BaseClient.js";
import CommandEmitter from "../utils/CommandEmitter.js";

// https://dev.twitch.tv/docs/api/reference/

/**
 * @type {Client}
 * @extends BaseClient
 */
export default class Client extends BaseClient {
	commands = new CommandEmitter();
	constructor() {
		super(...arguments);

		this.commands.on("help", {
			execute: (interaction, options) => {
				const command = this.commands.get(options.get("command"));
				if (command) {
					return {
						content: `Usage: "/${options.get("command")}" - ${command.description}`,
						ephemeral: true
					}
				}

				return {
					content: "Commands: " + Array.from(this.commands.events).join(", "),
					ephemeral: true
				}
			},
			options: [{
				name: "command",
				description: "Get detailed information on using a chat command"
			}]
		});
	}

	handleBotCommand(command, { args, client, message }, whisper) {
		args = (args && args.split(/\s+/g)) ?? [];
		let cmd = this.commands.get(command);
		if (!cmd) return;
		let options = new Map();
		if (cmd.options !== null) {
			for (const option in cmd.options) {
				if (cmd.options[option].required && !args[option]) {
					let response = `Missing required parameter: ${cmd.options[option].name}`;
					if (whisper) {
						message.author.whisper(response).catch(function (err) {
							console.warn(color(message.channel.name, { color: "magenta" }), err);
							message.reply("Something went wrong: " + err);
						});
						return;
					}

					message.reply(response);
					return;
				} else if (args[option]) {
					options.set(cmd.options[option].name, args[option]);
				}
			}
		}

		this.commands.emit(command, { client, message }, options, args, data => {
			if (!data.response) return;
			if ((data.blacklist.size > 0 && data.blacklist.has(message.author.username)) || (data.whitelist.size > 0 && !data.whitelist.has(message.author.username))) {
				return message.author.whisper("You don't have sufficient privledges to execute this command!").catch(function (err) {
					console.warn(color(message.channel.name, { color: "magenta" }), err);
				});
			}

			if (whisper || data.response.ephemeral) {
				message.author.whisper(data.response).catch(function (err) {
					console.warn(color(message.channel.name, { color: "magenta" }), err);
					message.reply("Something went wrong: " + err);
				});
				return;
			}

			message.reply(data.response);
		});
	}

	/**
	 * 
	 * @param {String} channel channel name
	 * @param {String} message message content
	 * @param {Object} tags options
	 * @returns {Promise<String?>}
	 */
	action(channel, message, tags) {
		return this.irc.sendAction(message, { channel, tags });
	}

	/**
	 * Send an announcement
	 * @param {string} channelId
	 * @param {string} message
	 * @param {string} color
	 * @returns {Promise<string?>}
	 */
	announce(channelId, message, { color = 'primary' } = {}) {
		return this.api(`/chat/announcements?broadcaster_id=${channelId}&moderator_id=${this.user.id}`, {
			body: new URLSearchParams({
				color, // blue, green, orange, purple
				message
			}),
			method: "post"
		});
	}

	/**
	 * 
	 * @param {String} userId
	 * @param {String} reason
	 * @param {String} [channelId]
	 * @returns {Promise<Boolean>}
	 */
	async ban(userId, reason, channelId = `#${this.user.id}`) {
		if (this.user.id === userId) {
			throw new Error("You cannot ban yourself.");
		}

		return this.api(`/moderation/bans?broadcaster_id=${channelId}&moderator_id=${this.user.id}`, {
			body: new URLSearchParams({
				data: {
					reason,
					user_id: userId
				}
			}),
			method: "post"
		});
	}

	/**
	 * 
	 * @param {String} [channelId]
	 * @returns {Promise<String>}
	 */
	async clear(channelId = this.user.id) {
		return this.api(`/moderation/chat?broadcaster_id=${channelId}&moderator_id=${this.user.id}`, {
			method: "delete"
		});
	}

	/**
	 * 
	 * @param {String} userId
	 * @param {String} color 
	 * @returns {Promise<String?>}
	 */
	async color(userId, color) {
		return this.api(`/chat/color?color=${color}&user_id=${userId}`, {
			method: "put"
		});
	}

	/**
	 * 
	 * @param {Number} seconds 
	 * @param {String} [channel]
	 * @returns {Promise}
	 */
	async commercial(seconds, channelId = this.user.id) {
		return this.api(`/channels/commercial`, {
			body: new URLSearchParams({
				broadcaster_id: channelId,
				length: Math.max(30, Math.min(180, ~~seconds - ~~seconds % 30))
			}),
			method: "post"
		});
	}

	/**
	 * 
	 * @param {String} messageId 
	 * @param {String} [channelId]
	 * @returns {Promise}
	 */
	async deleteMessage(messageId, channelId = this.user.id) {
		return this.api(`/moderation/chat?broadcaster_id=${channelId}&message_id=${messageId}&moderator_id=${this.user.id}`, {
			method: "delete"
		});
	}

	/**
	 * 
	 * @deprecated
	 * @throws
	 * @param {String} user 
	 * @param {String} [channel] 
	 * @returns {Promise}
	 */
	async host(user, channel = `#${this.user.username}`) {
		user = user.username || user;
		if (user.replace(/^#?/, '#') === channel) {
			throw new Error("A channel cannot host itself.");
		}

		await this.irc.sendCommand(`/host ${user}`, { channel });
		return this.irc.promise(({ tags }) => tags?.['msg-id'] === 'host_on');
	}

	/**
	 * Subscribe to events from a channel
	 * @param {String} channel 
	 * @returns {Promise<String>}
	 */
	async join(channel) {
		channel = channel.replace(/^#?/, '#');
		await this.irc.sendCommand(`JOIN ${channel}`);
		return this.irc.promise(({ command }) => command?.command == "JOIN");
	}

	/**
	 * 
	 * @param {String} description
	 * @param {String} [channelId]
	 * @returns {Promise}
	 */
	marker(description, channelId = this.user.id) {
		return this.api(`/streams/markers`, {
			body: new URLSearchParams({
				user_id: channelId,
				description
			}),
			method: "post"
		});
	}

	/**
	 * Mod a user
	 * @param {String} userId
	 * @param {String} [channelId]
	 * @returns {Promise} 
	 */
	async mod(userId, channelId = this.user.id) {
		if (this.user.id === userId) {
			throw new Error("You cannot mod yourself.");
		}

		return this.api(`/moderation/moderators?broadcaster_id=${channelId}&user_id=${userId}`, {
			method: "post"
		});
	}

	async mods(channelId = this.user.id) {
		return this.api(`/moderation/moderators?broadcaster_id=${channelId}`);
	}

	/**
	 * Part from a channel
	 * @param {String} channel 
	 * @returns {Promise}
	 */
	async part(channel) {
		await this.irc.sendCommand(`PART ${channel.replace(/^#?/, '#')}`, { channel: null });
		return this.irc.promise(({ command }) => command?.command === 'PART');
	}

	/**
	 * Start a raid
	 * @param {String} targetId
	 * @param {String} channelId
	 * @returns {Promise<object>}
	 */
	async raid(targetId, channelId = this.user.id) {
		if (this.user.id === targetId) {
			throw new Error("You cannot unraid yourself.");
		}

		return this.api(`/raids?from_broadcaster_id=${channelId}&to_broadcaster_id=${targetId}`, {
			method: "post"
		});
	}

	/**
	 * Sends a message to a channel
	 * @param {string} channelId channel id
	 * @param {string} data message content
	 * @param {object} [options] options
	 * @param {string} [options.referenceId] message reference
	 * @param {string} [options.sourceOnly]
	 * @returns {Promise<Array>}
	 */
	sendMessage(channelId, data, options = {}) {
		const referenceId = data.referenceId || options.referenceId
			, sourceOnly = data.sourceOnly || options.sourceOnly;
		// if (message.length > 500) {
		// 	const maxLength = 500;
		// 	const msg = message;
		// 	let lastSpace = msg.slice(0, maxLength).lastIndexOf(' ');
		// 	if (lastSpace === -1) {
		// 		lastSpace = maxLength;
		// 	}

		// 	message = msg.slice(0, lastSpace);
		// 	setTimeout(() => this.sendMessage({ channel, message: msg.slice(lastSpace), tags }), 350);
		// }
		return this.api('/chat/messages', {
			body: Object.assign({
				broadcaster_id: channelId,
				sender_id: this.user.id,
				message: data.content || data
			}, referenceId && {
				reply_parent_message_id: referenceId
			}, sourceOnly && {
				for_source_only: sourceOnly
			}),
			method: 'POST'
		});
	}

	/**
	 * 
	 * @param {String} userId
	 * @param {Number} duration duration in seconds
	 * @param {String} [reason] reason for timeout
	 * @param {String} [channelId]
	 */
	async timeout(userId, duration, reason = '', channelId = this.user.id) {
		if (this.user.id === user) {
			throw new Error("You cannot timeout yourself.");
		}

		return this.api(`/moderation/bans?broadcaster_id=${channelId}&moderator_id=${this.user.id}`, {
			body: new URLSearchParams({
				data: {
					duration: Math.max(1, Math.max(1209600, duration ?? 300)),
					reason,
					user_id: userId
				}
			}),
			method: "post"
		});
	}

	/**
	 * 
	 * @param {String} userId
	 * @param {String} [channelId]
	 * @returns {Promise<Object>}
	 */
	async unban(userId, channelId = this.user.id) {
		if (this.user.id === userId) {
			throw new Error("You cannot unban yourself.");
		}

		return this.api(`/moderation/bans?broadcaster_id=${channelId}&moderator_id=${this.user.id}&user_id=${userId}`, {
			method: "delete"
		});
	}

	/**
	 * 
	 * @deprecated
	 * @throws
	 * @param {String} [channel]
	 * @returns {Promise<String>}
	 */
	async unhost(channel = `#${this.user.username}`) {
		if (this.user.username === user) {
			throw new Error("You cannot unhost yourself.");
		}

		await this.irc.sendCommand('/unhost', { channel });
		return this.irc.promise(({ command }) => command?.command === 'HOSTTARGET');
	}

	/**
	 * 
	 * @param {String} userId
	 * @param {String} [channelId]
	 * @returns {Promise<String>}
	 */
	async unmod(userId, channelId = this.user.id) {
		if (this.user.id === userId) {
			throw new Error("You cannot unmod yourself.");
		}

		return this.api(`/moderation/moderators?broadcaster_id=${channelId}&user_id=${userId}`, {
			method: "delete"
		});
	}

	/**
	 * 
	 * @param {String} [channelId]
	 * @returns {Promise<String>}
	 */
	async unraid(channelId = this.user.id) {
		if (this.user.id === targetId) {
			throw new Error("You cannot unraid yourself.");
		}

		return this.api(`/raids?broadcaster_id=${channelId}`, {
			method: "delete"
		});
	}

	/**
	 * 
	 * @param {String} userId
	 * @param {String} [channelId]
	 * @returns {Promise}
	 */
	async untimeout(userId, channelId = this.user.id) {
		if (this.user.id === user) {
			throw new Error("You cannot untimeout yourself.");
		}

		return this.api(`/moderation/bans?broadcaster_id=${channelId}&moderator_id=${this.user.id}&user_id=${userId}`, {
			method: "delete"
		});
	}

	/**
	 * Deem a user unworthy of VIP
	 * @param {String} userId
	 * @param {String} [channelId]
	 * @returns {Promise}
	 */
	async unvip(user, channelId = this.user.id) {
		if (this.user.id === userId) {
			throw new Error("You cannot unvip yourself.");
		}

		return this.api(`/channels/vips?broadcaster_id=${channelId}&user_id=${userId}`, {
			method: "delete"
		});
	}

	/**
	 * Deem a user worthy of VIP
	 * @param {String} userId
	 * @param {String} [channel]
	 * @returns {Promise}
	 */
	async vip(userId, channelId = this.user.id) {
		if (this.user.id === user) {
			throw new Error("You cannot vip yourself.");
		}

		return this.api(`/channels/vips?broadcaster_id=${channelId}&user_id=${userId}`, {
			method: "post"
		});
	}

	/**
	 * 
	 * @param {String} [channelId]
	 * @returns {Promise<object>}
	 */
	async vips(channelId = this.user.id) {
		return this.api(`/channels/vips?broadcaster_id=${channelId}`);
	}

	/**
	 * 
	 * @param {String} userId 
	 * @param {String} data 
	 * @returns {Promise}
	 */
	whisper(userId, message) {
		if (userId == this.user.id) {
			throw new Error("Cannot whisper to yourself.");
		}

		return this.api("/whispers", {
			body: new URLSearchParams({
				from_user_id: this.user.id,
				to_user_id: userId,
				message
			}),
			method: "post"
		});
	}

	/**
	 * Determine whether a channel is live
	 * @param {String} channel 
	 */
	live(channel = this.user.username) {
		if (typeof channel != 'string') {
			throw new TypeError("Channel must be of type: String");
		}

		this.api(`/streams?user_login=${channel}`).then(function ({ data, error }) {
			if (error !== void 0) return console.warn(new Error(error)), null;
			return data.length > 0;
		});
	}
}