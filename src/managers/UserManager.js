import CachedManager from "./CachedManager.js";
import User from "../structures/User.js";

export default class extends CachedManager {
	/**
	 * Obtains one or multiple users from Twitch, or the user cache if it's already available.
	 * @param {string} id
	 * @param {object} [options]
	 * @returns {Promise<User>}
	 */
	async fetch(id, options = {}) {
		if (!options.force) {
			const existing = this.cache.get(id);
			if (existing) return existing;
		}

		const [data] = await this.client.api(`/channels?broadcaster_id=${~~id}`) || [];
		const instance = new User(this.client, data);
		return super.constructor.add.call(this, instance, { id: instance.name });
	}
}