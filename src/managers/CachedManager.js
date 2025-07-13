import Base from "../structures/Base.js";

/**
 * 
 * @extends {Base}
 * @abstract
 */
export default class extends Base {
	constructor(client, iterable) {
		super(client);

		/**
		 * The cache of items for this manager.
		 * @type {Map}
		 * @abstract
		 */
		Object.defineProperty(this, 'cache', { value: new Map(), writable: true });

		if (iterable !== void 0) {
			for (const item of iterable) {
				this.constructor.add.call(this, item);
			}
		}
	}

	static add(data, { id } = {}) {
		const existing = this.cache.get(id ?? data.id);
		if (existing !== void 0) {
			existing._patch(data);
			return existing;
		}

		const entry = data;
		this.cache.set(id ?? entry.id, data);
		return entry;
	}
}