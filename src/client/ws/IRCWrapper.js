import EventEmitter from "events";
import { Socket } from "net";
import color from "../../utils/color.js";
import parseMessage from "../../utils/parser.js";

const CAPS = new Set([
	"commands",
	"tags",
	"membership"
]);

export default class IRCWrapper extends EventEmitter {
	#pingTime = null;
	#pingTimeout = null;
	#staleTimeout = null;

	get #promiseDelay() {
		return Math.max(600, this.latency * 1e3 + 100);
	}

	_config = {
		decay: 1.5,
		delay: 1000,
		interval: {
			min: 1000,
			max: 30000
		},
		maxAttempts: Infinity
	}
	_reconnectAttempts = 0;
	_reconnecting = false;
	_reconnectTimeout = null;
	_socket = new Socket();

	latency = null;

	get connected() {
		return this._socket.readyState == 'open';
	}

	constructor(client) {
		super();

		Object.defineProperty(this, 'client', { value: client, writable: true });

		this._socket.on('error', err => err.code != 'ECONNRESET' && console.warn(err));
		this._socket.on('close', async hadError => {
			console.warn('Closed with error:', hadError);

			clearTimeout(this.#pingTimeout);
			clearTimeout(this.#staleTimeout);

			if (this._socket.errored && this._socket.errored.message !== 'CLIENT_DISCONNECT') {
				const attempt = await this.reconnect()
					.catch(err => this.client.options.debug && console.warn(err));
				if (attempt !== false) return;
			}

			this.emit("disconnect", new Error("Connection closed."));
		});
		this._socket.on('connect', () => {
			const caps = Array.from(CAPS.values());
			this._socket.write(`CAP REQ :twitch.tv/${caps.join(" twitch.tv/")}\r\n`);
			this._socket.write(`PASS oauth:${this.client.token}\r\n`);
			this._socket.write(`NICK ${this.client.user.username}\r\n`);
		});
		this._socket.on('data', buffer => {
			const parts = buffer.toString("utf8")
				.trim()
				.split('\r\n');
			parts.forEach(data => this._handleMessage(parseMessage(data)));
		});
	}

	_handleMessage(message) {
		if (!message) return;
		switch (message.command.command) {
		case "001":
			/** @event EventEmitter#ready */
			this.emit("ready");

			this._config.attempts = 0;
			this._config.delay = this._config.interval.min;
			this.ping(6e4);
			break;
		case "NOTICE":
			if (!message.tags) break;
			if ("Login authentication failed" === message.parameters) {
				this._socket.once("close", () => console.error(`Authentication failed. Refresh your token or get a new access code:\n> https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${this.application.id}&redirect_uri=https://localhost&scope=${Array.from(this.credentials.scope.values()).join('+')}`));
				this._socket.destroy();
			} else if ("You don't have permission to perform that action" === message.parameters) {
				console.log(`No permission. Check if the access token is still valid. Left ${msg.channel.name}`);
				this._socket.destroy();
			}
			break;
		case "PING":
			clearTimeout(this.#pingTimeout);
			this.send('PONG');
			break;
		case "PONG":
			clearTimeout(this.#staleTimeout);
			this.latency = (Date.now() - this.#pingTime) / 1e3;
			this.ping(6e4);
			break;
		case "RECONNECT":
			this.client.options.debug && (console.info('Received RECONNECT request from Twitch..'),
			console.info(`Disconnecting and reconnecting in ${Math.round(this._config.delay / 1000)} seconds..`));
			this.disconnect().catch(err => this.client.options.debug && console.error(err));
			this.reconnect().catch(err => this.client.options.debug && console.warn(err));
			break;
		default:
			this.emit('raw', message);
		}
	}

	/**
	 * 
	 * @returns {Promise<void>}
	 */
	async connect() {
		this._reconnecting = false;
		return new Promise((resolve, reject) => {
			this._socket.once("connect", resolve);
			this._socket.once("close", reject);
			this._socket.connect({
				host: "irc.chat.twitch.tv",
				port: 6667
			});
		})
	}

	ping(delay = 0) {
		clearTimeout(this.#pingTimeout);
		this.#pingTimeout = setTimeout(() => {
			this.send("PING", () => {
				this.#pingTime = Date.now();
				this.#staleTimeout = setTimeout(() => {
					this._socket.destroy('Ping timeout.');
				}, this._config.interval.min ?? 1e4);
			});
		}, delay);
	}

	// https://dev.twitch.tv/docs/irc/msg-id
	#resolveCases = new Set([
		'msg_bad_characters',
		'msg_channel_blocked',
		'msg_channel_suspended',
		'msg_duplicate',
		'msg_rejected',
		'msg_requires_verified_phone_number',
		'msg_slowmode',
		'msg_subsonly',
		'msg_timedout',
		'msg_verified_email',
		'raid_error_already_raiding',
		'raid_error_forbidden',
		'raid_error_too_many_viewers',
		'timeout_no_timeout',
		'unraid_error_no_active_raid',
		'whisper_banned_recipient',
		'whisper_limit_per_min',
		'whisper_limit_per_sec'
	]);

	#rejectCases = new Set([
		'invalid_user',
		'msg_duplicate',
		'msg_ratelimit',
		'msg_rejected_mandatory',
		'msg_suspended',
		'msg_banned',
		'msg_room_not_found',
		'msg_channel_suspended',
		'no_permission',
		'raid_error_self',
		'raid_error_unexpected',
		'raid_notice_mature',
		'raid_notice_restricted_chat',
		'tos_ban',
		'turbo_only_color',
		'unavailable_command',
		'unraid_error_unexpected',
		'unrecognized_cmd',
		'whisper_banned',
		'whisper_invalid_login',
		'whisper_invalid_self',
		'whisper_restricted',
		'whisper_restricted_recipient'
	]);

	#resolves(msgid) {
		return /^(already|no|usage)_/.test(msgid) || this.#resolveCases.has(msgid);
	}

	#rejects(msgid) {
		return (msgid ?? '').startsWith('bad_') || this.#rejectCases.has(msgid);
	}

	/**
	 * Wait for a response from the server
	 * @param {Function} callback 
	 * @returns {Promise}
	 */
	promise(callback = () => true) {
		if (typeof callback != "function") {
			throw new TypeError("Callback must be of type: Function");
		}

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.off("raw", listener);
				reject(new Error("Twitch did not respond in time."));
			}, this.#promiseDelay);
			const listener = async message => {
				if (await callback(message)) {
					clearTimeout(timeout);
					this.off("raw", listener);
					resolve(message);
				} else if (this.#rejects(message.tags?.['msg-id'])) {
					clearTimeout(timeout);
					this.off("raw", listener);
					reject(message.parameters);
				} else if (this.#resolves(message.tags?.['msg-id'])) {
					clearTimeout(timeout);
					this.off("raw", listener);
					resolve(message, message.parameters);
				}
			}

			this.on("raw", listener);
		});
	}

	reconnect() {
		if (this._config.maxAttempts > 0) {
			if (this._config.attempts >= this._config.maxAttempts) {
				this.emit("maxreconnect");
				return Promise.resolve(false);
			}

			if (!this._reconnecting) {
				this._reconnecting = true;
				this._reconnectAttempts++;
				return new Promise((resolve, reject) => {
					this._reconnectTimeout = this._config.delay = Math.min(this._config.interval.max, this._config.delay * this._config.decay);
					setTimeout(() => {
						this._connect()
							.then(resolve)
							.catch(reject)
					}, this._reconnectTimeout);
				});
			}
		}

		return Promise.resolve(false);
	}

	send(data, callback) {
		this._socket.write(data + '\r\n', callback);
	}

	// https://dev.twitch.tv/docs/irc/chat-commands
	// sendCommand(command) {
	sendCommand(command, { channel, delay = null, tags } = {}) {
		return new Promise((resolve, reject) => {
			if (!this.connected) {
				reject(new Error("Not connected to server."));
			} else if (delay === null || typeof delay == 'number') {
				if (delay === null) delay = this.#promiseDelay;
				setTimeout(() => reject(new Error("Twitch did not respond in time!")), delay);
			}

			const result = Object.entries(tags || {}).map(([k, v]) => `${_.escapeIRC(k)}=${_.escapeIRC(v)}`);
			const formedTags = !result.length ? null : `@${result.join(';')} `;

			this.client.options.debug && console.debug(`${typeof channel == 'string' ? `${color(channel, { color: "magenta" })} ` : ''}${color(`Executing command: ${command}`, { dim: true })}`);
			this.send(`${formedTags || ''}${typeof channel == 'string' ? `PRIVMSG ${channel} :` : ''}${command}`, err => err ? reject(err) : resolve(command));
		});
	}

	sendAction(action, options) {
		return this.sendCommand(`\u0001ACTION ${action}\u0001`, options);
	}

	destroy() {
		return new Promise((res, rej) => {
			const timeout = setTimeout(rej, 3e3);
			this._socket.once('close', () => {
				clearTimeout(timeout);
				this._socket = null;
				res();
			});
			this._socket.destroy(new Error('CLIENT_DISCONNECT'));
		});
	}
}