import EventEmitter from "events";
import http from "http";
import https from "https";

import IRCWrapper from "./ws/IRCWrapper.js";
import ChannelManager from "../managers/ChannelManager.js";
import CredentialManager from "../managers/CredentialManager.js";
import UserManager from "../managers/UserManager.js";
import Message from "../structures/Message.js";
import User from "../structures/User.js";
import color from "../utils/color.js";
import _ from "../utils/utils.js";
import TwitchAPIError from "../utils/TwtichAPIError.js";
import WebSocketWrapper from "./ws/WebSocketWrapper.js";
import SubscriptionTypes from "../utils/SubscriptionTypes.js";

// https://dev.twitch.tv/docs/chat/chatbot-guide/
// https://dev.twitch.tv/docs/chat/irc-migration/
// https://dev.twitch.tv/docs/pubsub/

/**
 * @type {BaseClient}
 * @extends {EventEmitter}
 */
export default class BaseClient extends EventEmitter {
	application = null;
	channels = new ChannelManager(this);
	credentials = new CredentialManager(this);
	options = { channels: [] }
	owner = null;
	ownerId = null;
	users = new UserManager(this);
	user = null;
	userId = null;

	/**
	 * 
	 * @param {Object} [options]
	 * @param {Array<String>} [options.channels]
	 * @param {Boolean} [options.debug]
	 * @param {String} [options.prefix]
	 */
	constructor(options) {
		if (typeof options != "object" || options instanceof Array) {
			throw TypeError("Options must be of type: Object");
		}

		super();

		Object.defineProperty(this, 'token', { value: null, writable: true });
		Object.defineProperty(this, 'irc', { value: new IRCWrapper(this), writable: true });

		this.irc.on('ready', async () => {
			this.emit('ready');
			for (const channel of this.options.channels) {
				await this.join(channel)
					.then(() => {
						if (!this.options.joinInterval) return;
						return new Promise(res => setTimeout(res, Math.max(300, this.options.joinInterval ?? 2e3)));
					});
			}

			// this.emit('ready');
		});
		this.irc.on('raw', this._handleIRCMessage.bind(this));

		Object.defineProperty(this, 'ws', { value: new WebSocketWrapper(this), writable: true });

		this.ws.on('raw', this._handleWSMessage.bind(this));

		Object.defineProperty(this, 'options', { enumerable: false });
		Object.defineProperty(this, 'owner', { enumerable: false });

		for (const key in options) {
			switch (key.toLowerCase()) {
			case "channels":
				if (options[key] instanceof Array) {
					this.options.channels.push(...options[key]);
					break;
				}

				throw new TypeError("options[channels] must be of type: Array");
			case 'clientid':
				this.application = { id: options[key] };
				break;
			case 'credentials':
				this.credentials.define(options[key]);
				break;
			case "debug":
				this.options.debug = Boolean(options[key]);
				this.options.debug && (process.on('uncaughtException', err => console.warn('Uncaught exception:', err)),
				process.on('unhandledRejection', err => console.warn('Unhandled rejection:', err)));
				break;
			case "liveevent":
				this.options.liveEvent = true;
				break;
			case "owner":
				this.owner = options[key];
				this.owner && (this.ownerId = this.owner.id);
				break;
			case "prefix":
				this.prefix = options[key] || this.prefix;
				break;
			case "reconnect":
				const config = options[key];
				if (typeof config != "object")
					throw new TypeError("Config must be of type: Object");

				for (let key in config) {
					switch (key.toLowerCase()) {
					case 'attempts':
					case 'maxattempts':
						this.irc._config.maxAttempts = Math.max(0, ~~config[key]);
						break;
					case "decay":
						this.irc._config.decay = config[key] ?? this.decay;
						break;
					case "interval":
						if (typeof config[key] != "object")
							throw new TypeError("Config[Interval] must be of type: Object");

						this.irc._config.interval.min = Math.max(0, ~~config[key].min);
						this.irc._config.interval.max = Math.max(this.irc._config.interval.min, ~~config[key].max);
					}
				}
				break;
			case 'subscriptions':
				this.options.subscriptions = new Set(options[key]);
			}
		}

		if (this.options.debug) {
			this.on("channelBanAdd", m => console.debug(color(m.channel.name, { color: "magenta" }), `${m.content} has been banned.`));
			this.on("channelCreate", c => console.debug(color(c.name, { color: "magenta" }), color('JOINED', { color: "yellow" })));
			this.on("channelDelete", (c, err) => console.debug(color(c.name, { color: "magenta" }), color('LEFT', { color: "red" }), color(err ?? '', { dim: true })));
			this.on("channelHostAdd", (channel, user, viewers) => console.debug(color(channel.name, { color: "magenta" }), `Now hosting ${user} for ${viewers} viewer(s).`));
			this.on("channelHostRemove", channel => console.debug(color(channel.name, { color: "magenta" }), `Exited host mode.`));
			this.on("channelNotice", message => console.debug(color(message.command.channel, { color: "magenta" }), message.parameters));
			this.on("channelTimeoutAdd", (msg, duration) => console.debug(color(msg.channel.name, { color: "magenta" }), `${msg.content} has been timed out for ${duration} seconds.`));
			this.on("messageDeleteBulk", channel => console.debug(color(channel.name, { color: "magenta" }), `Chat was cleared by a moderator.`));
			this.on("messageCreate", msg => console.debug(color(msg.channel.name, { color: "magenta" }), `${color(msg.author.username, { color: "yellow" })}: ${msg.content}`));
			this.on("messageDelete", msg => console.debug(color(msg.channel.name, { color: "magenta" }), color(`${color(msg.author.username, { color: "yellow" })}'s message has been deleted.`, { italic: true })));
			this.on("chatNotice", message => console.debug(color(message.command.channel, { color: "magenta" }), message.parameters));
			this.on("disconnect", error => console.debug(error.message));
			this.on("interactionCreate", msg => console.debug(color(msg.channel.name, { color: "magenta" }), `*<${msg.author.username}>: ${msg.content}`));
			this.on("maxreconnect", () => console.error("Maximum reconnection attempts reached."));
			this.on("reconnect", () => console.debug(`Reconnecting in ${Math.round(this.irc._config.delay / 1000)} seconds..`));
			this.on("refreshtoken", console.debug);
			this.on("whisper", msg => console.debug(color(`[WHISPER]`, { color: "magenta" }), `${color(msg.author.username, { color: "yellow" })}: ${msg.content}`));
		}
	}

	/**
	 * 
	 * @param {(string|object)} option url, path, or options
	 * @param {object} options options
	 * @param {boolean} bypass bypass the path prefix
	 * @returns {Promise<Response>} 
	 */
	api(option, options = typeof option == "object" ? option : {}) {
		let host = options.hostname || options.host || 'api.twitch.tv';
		let path = '/helix' + (options.pathname || options.path || option || '');
		let url = new URL(options.url || `https://${host}${path}`);
		let request = new Request(url, {
			...options, headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				...options.headers
			}
		});

		this.token !== null && request.headers.set("Authorization", `Bearer ${this.token}`);
		this.application !== null && request.headers.set("Client-Id", this.application.id);

		const contentType = request.headers.get("Content-Type");
		return new Promise((resolve, reject) => {
			(/^https:$/i.test(url.protocol) ? https : http).request({
				host: url.hostname,
				path: url.pathname + url.search,
				method: request.method,
				headers: Object.fromEntries(request.headers.entries())
			}, async function (res) {
				const buffers = [];
				for await (const chunk of res) {
					buffers.push(chunk);
				}

				let data = Buffer.concat(buffers);
				if (contentType.startsWith("image/png")) {
					if (contentType.includes("base64")) {
						data = 'data:image/png; base64, ' + data.toString("base64");
					}
					return void resolve(data);
				}

				res.once("error", reject);
				try {
					data = JSON.parse(data);
					if (data.error)
						reject(new TwitchAPIError(data.message || data.error || data, { code: data.status ?? res.statusCode }));
					return resolve(data.data ?? data);
				} catch { }
				resolve(data.toString("utf8"));
			}).end(contentType == "application/json" ? JSON.stringify(options.body) : (new URLSearchParams(options.body) || url.searchParams).toString());
		});
	}

	/**
	 * 
	 * @param {(String|Object)} [token]
	 * @param {String} [token.token]
	 * @returns {Promise<void>}
	 */
	async login(token = process.env.TWITCH_TOKEN) {
		token instanceof Object && (token = token.token);
		token ||= await this.credentials.get().then(r => r.access_token);
		return this.credentials.validate(token).then(async credential => {
			this.application = { id: credential.client_id };
			this.user = new User(this, credential);
			this.options.debug && console.warn(`Your token will expire on ${credential.deletedAt}`);
			this.token = token;
			await this.irc.connect();
			this.ws.connect();
		}).catch(async err => {
			if (err.code !== 401)
				throw err;

			const credential = await this.credentials.refresh();
			return this.login(credential.access_token);
		})
	}

	/** @fires EventEmitter#ready */
	_handleIRCMessage(message) {
		this.emit("raw", message);
		// console.log(message);
		const msg = new Message(this, message) ?? null;
		switch (message.command.command) {
		case "CLEARCHAT":
			if (message.parameters !== null) {
				const duration = ~~message.tags['ban-duration'];
				if (duration > 0) {
					this.emit("channelTimeoutAdd", msg, duration);
				} else {
					this.emit("channelBanAdd", msg);
				}
				break;
			}

			this.emit("messageDeleteBulk", msg.channel);
			break;
		case "CLEARMSG":
			this.emit("messageDelete", msg);
			break;
		case "GLOBALUSERSTATE":
			if (message.tags['emote-sets'] !== undefined && message.tags['emote-sets'] !== this.emotes) {
				this.emotes = message.tags['emote-sets'];
				this.emit('emotesets', this.emotes, null);
			}
			break;
		case 'HOSTTARGET':
			const msgSplit = msg.content.split(' ');
			const viewers = ~~msgSplit[1] || 0;
			if (msgSplit[0] === '-') {
				this.emit("channelHostRemove", msg.channel, viewers);
				this.emit('_promiseUnhost');
			} else {
				this.emit("channelHostAdd", msg.channel, msgSplit[0], viewers);
			}
			break;
		case "JOIN":
			if (this.user.username === message.source.nick) {
				this.emit("channelCreate", msg.channel);
				break;
			}

			this.emit("channelMemberAdd", msg.channel, msg.author);
			break;
		case "NOTICE":
			this.emit("chatNotice", message);
			if (!message.tags) break;
			switch (message.tags["msg-id"]) {
			case 'autohost_receive':
				console.log("AUTOHOST:", message);
				break;
			case 'ban_success':
				this.emit("channelBanAdd", msg.channel, msg.author);
				break;
			case "emote_only_on":
				msg.channel.modifiers.add("EMOTES_ONLY");
				this.emit("chatUpdate", msg.channel);
				this.emit("_promiseEmoteonly");
				break;
			case "emote_only_off":
				msg.channel.modifiers.delete("EMOTES_ONLY");
				this.emit("chatUpdate", msg.channel);
				this.emit("_promiseEmoteonlyoff");
				break;
			// Mods command failed
			case 'usage_mods':
				this.emit('_promiseMods', msg);
				break;
			case "r9k_on":
				msg.channel.modifiers.add("R9K_MODE");
				this.emit("chatUpdate", msg.channel);
				this.emit("_promiseR9kbeta");
				break;
			case 'r9k_off':
				msg.channel.modifiers.delete("R9K_MODE");
				this.emit("chatUpdate", msg.channel);
				this.emit("_promiseR9kbetaoff");
				break;
			// Do not handle followers_on/off/on_zero nor slow_on/off here, listen to the ROOMSTATE notice instead as it returns the delay.
			case "subs_on":
				msg.channel.subscribersOnly = true;
				this.emit("chatUpdate", msg.channel);
				this.emit("_promiseSubscribers")
				break;
			case "subs_off":
				msg.channel.subscribersOnly = false;
				this.emit("chatUpdate", msg.channel);
				this.emit("_promiseSubscribersoff");
				break;
			case 'room_mods': {
				const mods = msg.content.replace(/.*:\s+/, '').toLowerCase().split(/,\s+/)
				mods.forEach(mod => msg.channel.moderators.add(mod));
				this.emit("chatModerators", msg.channel);
				break;
			}

			case "no_mods":
				this.emit("chatModerators", msg.channel);
				break;
			case "vips_success": {
				const listSplit = (msg.endsWith('.') ? msg.slice(0, -1) : msg).split(': ');
				const vips = (listSplit.length > 1 ? listSplit[1] : '').toLowerCase()
					.split(', ')
					.filter(n => n);
				vips.forEach(vip => msg.channel.vips.add(vip));
				this.emit("chatVips", msg.channel);
				break;
			}

			case "no_vips":
				this.emit("chatVips", msg.channel);
				break;
			case 'mod_success':
				this.emit("_promiseMod", msg.channel, msg.author);
				break;
			// VIPs command failed
			case 'usage_vips':
				this.emit("_promiseVips", msg.channel);
				break;
			// VIP command failed
			case 'usage_vip':
			case 'bad_vip_grantee_banned':
			case 'bad_vip_grantee_already_vip':
			case 'bad_vip_max_vips_reached':
			case 'bad_vip_achievement_incomplete':
				this.emit("_promiseVip", msg.channel);
				break;
			// VIP command success
			case 'vip_success':
				this.emit("_promiseVip", message);
				break;
			// Mod command failed
			case 'usage_mod':
			case 'bad_mod_banned':
			case 'bad_mod_mod':
				this.emit('_promiseMod', message);
				break;
			// Unmod command success
			case 'unmod_success':
				this.emit('_promiseUnmod', message);
				break;
			// Unvip command success.
			case 'unvip_success':
				this.emit('_promiseUnvip', message);
				break;
			// Unmod command failed
			case 'usage_unmod':
			case 'bad_unmod_mod':
				this.emit('_promiseUnmod', message);
				break;
			// Unvip command failed
			case 'usage_unvip':
			case 'bad_unvip_grantee_not_vip':
				this.emit('_promiseUnvip', message);
				break;
			case 'color_changed':
				this.emit('_promiseColor', message);
				break;
			// Color command failed
			case 'usage_color':
			case 'turbo_only_color':
				this.emit('_promiseColor', message);
				break;
			case 'commercial_success':
				this.emit('_promiseCommercial', message);
				break;
			// Commercial command failed
			case 'usage_commercial':
			case 'bad_commercial_error':
				this.emit('_promiseCommercial', message);
				break;
			// Host command success
			case 'hosts_remaining': {
				const remainingHost = (!isNaN(msg[0]) ? parseInt(msg[0]) : 0);
				this.emit('_promiseHost', msg.channel, ~~remainingHost);
				break;
			}

			// Host command failed
			case 'bad_host_hosting':
			case 'bad_host_rate_exceeded':
			case 'bad_host_error':
			case 'usage_host':
				this.emit('_promiseHost', message);
				break;
			// r9kbeta command failed
			case 'already_r9k_on':
			case 'usage_r9k_on':
				this.emit('_promiseR9kbeta', message);
				break;
			// r9kbetaoff command failed
			case 'already_r9k_off':
			case 'usage_r9k_off':
				this.emit('_promiseR9kbetaoff', message);
				break;
			case "timeout_success":
				this.emit("_promiseTimeout");
				break;
			case 'delete_message_success':
				this.emit("messageDelete", msg);
				break;
			// Subscribersoff command failed
			case 'already_subs_off':
			case 'usage_subs_off':
				this.emit('_promiseSubscribersoff', message);
				break;
			// Subscribers command failed
			case 'already_subs_on':
			case 'usage_subs_on':
				this.emit('_promiseSubscribers', message);
				break;
			// Emoteonlyoff command failed
			case 'already_emote_only_off':
			case 'usage_emote_only_off':
				this.emit('_promiseEmoteonlyoff', message);
				break;
			// Emoteonly command failed
			case 'already_emote_only_on':
			case 'usage_emote_only_on':
				this.emit('_promiseEmoteonly', message);
				break;
			// Slow command failed
			case 'usage_slow_on':
				this.emit('_promiseSlow', message);
				break;
			// Slowoff command failed
			case 'usage_slow_off':
				this.emit('_promiseSlowoff', message);
				break;
			// Timeout command failed
			case 'usage_timeout':
			case 'bad_timeout_admin':
			case 'bad_timeout_anon':
			case 'bad_timeout_broadcaster':
			case 'bad_timeout_duration':
			case 'bad_timeout_global_mod':
			case 'bad_timeout_mod':
			case 'bad_timeout_self':
			case 'bad_timeout_staff':
				this.emit('_promiseTimeout', message);
				break;
			// Unban command success
			// Unban can also be used to cancel an active timeout.
			case 'untimeout_success':
			case 'unban_success':
				this.emit('_promiseUnban');
				break;
			// Unban command failed
			case 'usage_unban':
			case 'bad_unban_no_ban':
				this.emit('_promiseUnban');
				break;
			// Delete command failed
			case 'usage_delete':
			case 'bad_delete_message_error':
			case 'bad_delete_message_broadcaster':
			case 'bad_delete_message_mod':
				this.emit('_promiseMessageDelete', message);
				break;
			// Unhost command failed
			case 'usage_unhost':
			case 'not_hosting':
				this.emit('_promiseUnhost', message);
				break;
			// Whisper command failed
			case 'whisper_invalid_login':
			case 'whisper_invalid_self':
			case 'whisper_limit_per_min':
			case 'whisper_limit_per_sec':
			case 'whisper_restricted':
			case 'whisper_restricted_recipient':
				this.emit('_promiseWhisper', message);
				break;
			// Permission error
			case 'no_permission':
			case 'msg_banned':
			case 'msg_room_not_found':
			case 'msg_channel_suspended':
			case 'tos_ban':
			case 'invalid_user':
				[
					'_promiseBan',
					'_promiseClear',
					'_promiseUnban',
					'_promiseTimeout',
					'_promiseDeletemessage',
					'_promiseMods',
					'_promiseMod',
					'_promiseUnmod',
					'_promiseVips',
					'_promiseVip',
					'_promiseUnvip',
					'_promiseCommercial',
					'_promiseHost',
					'_promiseUnhost',
					'_promiseJoin',
					'channelDelete',
					'_promiseR9kbeta',
					'_promiseR9kbetaoff',
					'_promiseSlow',
					'_promiseSlowoff',
					'_promiseFollowers',
					'_promiseFollowersoff',
					'_promiseSubscribers',
					'_promiseSubscribersoff',
					'_promiseEmoteonly',
					'_promiseEmoteonlyoff',
					'_promiseWhisper'
				].forEach(event => this.emit(event, msg.channel, message.parameters));
				break;
			// Automod-related
			case 'msg_rejected':
			case 'msg_rejected_mandatory':
				this.emit("chatAutomod", msg);
			}
			break;
		case "PART":
			if (this.user.username === message.source.nick) {
				this.channels.cache.delete(msg.channel.id);
				this.emit("channelDelete", msg.channel);
				break;
			}

			this.emit("channelMemberRemove", msg.channel);
			break;
		case "PRIVMSG":
			if ('botCommand' in message.command) {
				this.emit("command", message.command.botCommand, msg);
				this.handleBotCommand(message.command.botCommand, { client: this, message: msg, args: message.command.botCommandParams });
			}

			// Message is an action (/me <message>)
			const isActionMessage = /^\u0001ACTION ([^\u0001]+)\u0001$/.test(msg.content);
			msg.content = msg.content.replace(/^\u0001ACTION |\u0001$/g, '');
			if ('bits' in message.tags) {
				this.emit('cheer', msg, message.tags);
			} else {
				//Handle Channel Point Redemptions (Require's Text Input)
				if ('msg-id' in message.tags) {
					if (message.tags['msg-id'] === 'highlighted-message') {
						const rewardtype = message.tags['msg-id'];
						this.emit('redeem', msg, rewardtype, message.tags);
					} else if (message.tags['msg-id'] === 'skip-subs-mode-message') {
						const rewardtype = message.tags['msg-id'];
						this.emit('redeem', msg, rewardtype, message.tags);
					}
				} else if ('custom-reward-id' in message.tags) {
					const rewardtype = message.tags['custom-reward-id'];
					this.emit('redeem', msg, rewardtype, message.tags);
				}

				if (isActionMessage) {
					msg.action = message.tags;
					this.emit("interactionCreate", msg);
				} else {
					this.emit("messageCreate", msg);
				}
			}
			break;
		case "ROOMSTATE": {
			let subscribe;
			(subscribe = async channel => {
				// Subscribe to live events
				if (this.options.liveEvent) {
					const stream = await channel.fetchStream();
					if (stream === null)
						return void setTimeout(subscribe, 6e4, channel);

					this.emit("channelStreamCreate", channel.stream);
				}
			})(msg.channel);
			msg.channel._patch(message);
			this.emit("roomState", msg.channel, msg.channel.modifiers);
			break;
		}

		case 'USERNOTICE':
			this.emit("channelNotice", message);
			const plan = message.tags['msg-param-sub-plan'] ?? '';
			const planName = _.unescapeIRC(message.tags['msg-param-sub-plan-name'] ?? '') || null;
			const prime = plan.includes('Prime');
			const methods = { prime, plan, planName };
			const streakMonths = ~~(message.tags['msg-param-streak-months'] || 0);
			const recipient = message.tags['msg-param-recipient-display-name'] || message.tags['msg-param-recipient-user-name'];
			const giftSubCount = ~~tags['msg-param-mass-gift-count'];
			switch (message.tags["msg-id"]) {
			case 'resub':
				this.emit("resub", msg.channel, msg.author.username, streakMonths, msg, methods);
				break;
			case 'sub':
				this.emit('subscribe', msg.channel, msg.author.username, methods, msg);
				break;
			case 'subgift':
				this.emit('subgift', msg.channel, msg.author.username, streakMonths, recipient, methods);
				break;
			case 'anonsubgift': // Handle anonymous gift sub
				this.emit('anonsubgift', msg.channel, streakMonths, recipient, methods);
				break; // Need proof that this event occur
			case 'submysterygift': // Handle random gift subs
				this.emit('submysterygift', msg.channel, msg.author.username, giftSubCount, methods);
				break;
			case 'anonsubmysterygift': // Handle anonymous random gift subs
				this.emit('anonsubmysterygift', msg.channel, giftSubCount, methods);
				break; // Need proof that this event occur
			case 'primepaidupgrade': // Handle user upgrading from Prime to a normal tier sub
				this.emit('primepaidupgrade', msg.channel, msg.author.username, methods);
				break;
			case 'giftpaidupgrade': { // Handle user upgrading from a gifted sub
				const sender = tags['msg-param-sender-name'] || tags['msg-param-sender-login'];
				this.emit('giftpaidupgrade', msg.channel, msg.author.username, sender);
				break;
			}
			case 'anongiftpaidupgrade': // Handle user upgrading from an anonymous gifted sub
				this.emit('anongiftpaidupgrade', msg.channel, msg.author.username);
				break;
			case 'announcement': {
				const color = tags['msg-param-color'];
				this.emit('announcement', msg.channel, msg, false, color);
				break;
			}
			case 'raid': {
				const username = tags['msg-param-displayName'] || tags['msg-param-login'];
				const viewers = +tags['msg-param-viewerCount'];
				this.emit('raided', msg.channel, username, viewers);
				break;
			}
			default:
				this.emit('usernotice', message.tags["msg-id"], msg.channel, message);
			}
			break;
		case "USERSTATE":
			if (message.tags['user-type'] === 'mod') {
				msg.channel.moderators.add(this.user.username);
			}

			// Emote-sets has changed, update it
			if (message.tags["emote-sets"] !== this.emotes) {
				this.emotes = message.tags["emote-sets"];
				this.emit("emotesets", this.emotes, null);
			}
			break;
		case "WHISPER":
			if ('botCommand' in message.command) {
				this.emit("command", message.command.botCommand, msg);
				this.handleBotCommand(message.command.botCommand, { client: this, message: msg, args: message.command.botCommandParams }, true);
			}

			this.emit("whisper", msg);
			break;
		default:
			// this.options.debug && console.warn(`Could not parse message with no prefix:\n${JSON.stringify(message, null, 4)}`);
		}
	}

	_handleWSMessage(message) {
		const { metadata, payload } = message
			, { event } = payload;
		switch (metadata.subscription_type) {
		case SubscriptionTypes.WhisperReceived:
			// const msg = new Message(this, event);
			// msg.author.id = event.from_user_id;
			// msg.author.username = event.from_user_login;
			// msg.author.displayName = event.from_user_displayName;
			// msg.id = event.whisper_id;
			// msg.content = event.whisper.text;
			break;
		default:
			console.log('Unhandled WS Message', message);
		}
	}

	async destroy() {
		await this.irc.destroy();
	}
}