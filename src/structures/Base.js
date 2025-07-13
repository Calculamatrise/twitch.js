export default class {
	constructor(client) {
		/**
		 * The client that created this manager
		 * @name BaseManager#client
		 * @readonly
		 */
		Object.defineProperty(this, 'client', { value: client, writable: true });
	}
}