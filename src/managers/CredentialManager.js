import Base from "../structures/Base.js";
import Credential from "../structures/Credential.js";
import TwitchAPIError from "../utils/TwtichAPIError.js";

const credentialsApiEndpoint = 'https://id.twitch.tv/oauth2/';

export default class extends Base {
	#clientSecret = process.env.CLIENT_SECRET || null;
	#refreshToken = process.env.REFRESH_TOKEN || null;
	// https://dev.twitch.tv/docs/authentication/scopes/
	scope = new Set();
	define({ clientSecret, refreshToken }) {
		clientSecret && (this.#clientSecret = clientSecret);
		refreshToken && (this.#refreshToken = refreshToken);
	}

	// https://twitchtokengenerator.com/
	// https://twitchapps.com/tokengen/
	authorizationURL(scope) {
		return credentialsApiEndpoint + 'authorize?' +
			new URLSearchParams({
				client_id: this.client.application.id,
				redirect_uri: 'https://localhost',
				response_type: 'token',
				scope: Array.from((scope || this.scope).values()).map(s => encodeURI(s)).join('+')
			})
	}

	// https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
	// https://dev.twitch.tv/docs/authentication/scopes/
	authorize(code) {
		// https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${this.application.id}&redirect_uri=https://localhost&scope=${Array.from(this.#scopes.values()).join('+')}
		return this.client.api({
			url: credentialsApiEndpoint + 'token',
			body: {
				client_id: this.client.application.id,
				client_secret: this.#clientSecret,
				grant_type: 'authorization_code',
				code,
				redirect_uri: 'https://localhost'
				// refresh_token: this.#refreshToken
			},
			method: 'POST'
		})
	}

	get(type = 'client_credentials') {
		return this.client.api({
			url: credentialsApiEndpoint + 'token',
			body: {
				client_id: this.client.application.id,
				client_secret: this.#clientSecret,
				grant_type: type
			},
			method: 'POST'
		}).then(r => new Credential(r))
	}

	refresh(refreshToken = this.#refreshToken) {
		return this.client.api({
			url: credentialsApiEndpoint + 'token',
			body: {
				client_id: this.client.application.id,
				client_secret: this.#clientSecret,
				grant_type: 'refresh_token',
				refresh_token: refreshToken
			},
			method: 'POST'
		}).then(r => {
			if (r.status < 200 || r.status > 299)
				throw new TwitchAPIError(r.message, { code: r.status });

			return new Credential(r)
		})
	}

	revoke(token) {
		return this.client.api({
			url: credentialsApiEndpoint + 'revoke',
			body: {
				client_id: this.client.application.id,
				token
			},
			method: 'POST'
		})
	}

	async validate(token, refresh = false) {
		if (typeof token != 'string')
			throw new TypeError('Token must be of type: string');

		return this.client.api({
			url: credentialsApiEndpoint + 'validate',
			headers: { Authorization: `Bearer ${token}` }
		}).then(r => {
			if (r.status < 200 || r.status > 299) {
				if (r.status === 401 && refresh)
					return this.refresh(this.#refreshToken)
						.then(r => this.validate(r.access_token));

				throw new TwitchAPIError(r.message, { code: r.status });
			}

			for (const scope of r.scopes) {
				this.scope.add(scope);
			}

			return new Credential(r)
		})
	}
}