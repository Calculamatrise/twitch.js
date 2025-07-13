import EventEmitter from "events";
import { WebSocket } from "http";
import color from "../../utils/color.js";

// wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30
// https://dev.twitch.tv/docs/eventsub/handling-websocket-events/
export default class WebSocketWrapper extends EventEmitter {
	#pingTime = null;
	#pingTimeout = null;
	#staleTimeout = null;

	_config = {
		decay: 1.5,
		delay: 1000,
		interval: {
			min: 1000,
			max: 30000
		},
		keepAliveTimeout: 30,
		maxAttempts: Infinity
	}
	_reconnectAttempts = 0;
	_reconnecting = false;
	_reconnectTimeout = null;
	_sessionId = null;
	_ws = null;

	latency = null;
	subscriptions = new Map();

	get connected() {
		return this._ws.readyState === WebSocket.OPEN;
	}

	constructor(client) {
		super();

		Object.defineProperty(this, 'client', { value: client, writable: true });
	}

	async _handleMessage(message) {
		const payload = message.payload;
		switch (message.metadata?.message_type) {
		case 'notification':
			this.emit('raw', message);
			this.emit(message.metadata.subscription_type, payload);
			break;
		case 'revocation':
			await this.client.credentials.refresh();
			this.reconnect();
			break;
		case 'session_keepalive':
			// this.ping();
			break;
		case 'session_reconnect':
			this.reconnect();
			break;
		case 'session_welcome':
			this._sessionId = payload.session.id;
			this._config.keepAliveTimeout = payload.session.keepalive_timeout_seconds;
			this.emit('ready');
			for (const type of this.client.options.subscriptions)
				await this.subscribe(type);
			break;
		default:
			console.log('unknown message type', message);
		}
	}

	/**
	 * 
	 * @returns {Promise<void>}
	 */
	async connect() {
		this._reconnecting = false;
		return new Promise((res, rej) => {
			this._ws = new WebSocket(`wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=${this._config.keepAliveTimeout}`);
			this._ws.addEventListener('error', err => err.code != 'ECONNRESET' && console.warn(err));
			this._ws.addEventListener('message', ({ data }) => this._handleMessage(JSON.parse(data)));
			var open = () => {
				this._ws.removeEventListener('close', close);
				res();
			}
			  , close = () => {
				this._ws.removeEventListener('open', open);
				rej();
			};
			this._ws.addEventListener('close', close, { once: true });
			this._ws.addEventListener('open', open, { once: true });
		})
	}

	fetchSubscriptions({ force } = {}) {
		if (this.subscriptions.size > 0 && !force)
			return this.subscriptions;

		return this.client.api('/eventsub/subscriptions').then(subscriptions => {
			for (const subscription of subscriptions)
				this.subscriptions.set(subscription.type, subscription);

			return this.subscriptions
		});
	}

	ping(delay = 0) {
		clearTimeout(this.#pingTimeout);
		this.#pingTimeout = setTimeout(() => {
			this._ws.send({}, 'session_keepalive');
			this.#pingTime = Date.now();
			this.#staleTimeout = setTimeout(() => {
				this._ws.destroy('Ping timeout.');
			}, this._config.interval.min ?? 1e4);
		}, delay);
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

	send(payload, type = 'session_keepalive') {
		this._ws.send({
			metadata: {
				message_id: crypto.randomUUID(),
				message_type: type,
				message_timestamp: new Date().toISOString()
			},
			payload: payload || {}
		});
	}

	// https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#subscription-types
	subscribe(type) {
		if (this.subscriptions.has(type))
			return this.subscriptions;

		return this.client.api('/eventsub/subscriptions', {
			body: {
				type,
				version: '1',
				condition: {
					broadcaster_user_id: this.client.user.id,
					user_id: this.client.user.id
				},
				transport: {
					method: 'websocket',
					session_id: this._sessionId
				}
			},
			headers: { 'Content-Type': 'application/json' },
			method: 'POST'
		}).then(subscriptions => {
			for (const subscription of subscriptions)
				this.subscriptions.set(subscription.type, subscription);

			return this.subscriptions
		});
	}

	unsubscribe(type) {
		if (!this.subscriptions.has(type))
			return this.subscriptions;

		const subscription = this.subscriptions.get(type);
		return this.client.api('/eventsub/subscriptions?' +
			new URLSearchParams({
				id: subscription.id
			}), { method: 'DELETE' }).then(subscriptions => {
			return this.subscriptions.delete(type);
		});
	}

	destroy() {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(reject, 3e3);
			this._ws.addEventListener('close', () => {
				clearTimeout(timeout);
				this._ws = null;
				resolve();
			});
			this._ws.close(new Error('CLIENT_DISCONNECT'));
		});
	}
}