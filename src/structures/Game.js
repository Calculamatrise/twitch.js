import Base from "./Base.js";

export default class Game extends Base {
	#art = null;
	id = null;
	name = null;

	/**
	 * 
	 * @param {Object} data 
	 */
	constructor(client, data = {}) {
		super(client);

		this.id = data.game_id;
		this.name = data.game_name;
		if ('box_art_url' in data) {
			this.#art = data.box_art_url;
		}
	}

	displayArtURL() {
		return this.#art ?? this.client.api(`/games?id=${~~this.id}`).then(data => {
			if (data.length == 0) return this.#art = false;
			return this.#art = data.at(0).box_art_url ?? false;
		});
	}
}