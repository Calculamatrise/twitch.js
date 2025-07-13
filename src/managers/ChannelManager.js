import CachedManager from "./CachedManager.js";
import Channel from "../structures/Channel.js";

export default class extends CachedManager {
	/**
	 * Obtains one or multiple channels from Twitch, or the channel cache if it's already available.
	 * @param {string} id
	 * @param {object} [options]
	 * @returns {Promise<Channel>}
	 */
	async fetch(id, options = {}) {
		if (!options.force) {
			const existing = this.cache.get(id);
			if (existing) return existing;
		}

		const [data] = await this.client.api(`/channels?broadcaster_id=${~~id}`) || [];
		const channel = new Channel(this.client, data);
		return super.constructor.add.call(this, channel, { id: channel.name });
	}
}