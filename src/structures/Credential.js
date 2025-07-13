export default class Credential {
	deletedTimestamp = null;
	constructor(data) {
		Object.defineProperty(this, 'deletedAt', { value: null, writable: true });

		for (const key in data) {
			switch (key) {
			case 'expires_in':
				this.deletedAt = new Date(Date.now() + data[key]);
				this.deletedTimestamp = this.deletedAt.getTime();
				break;
			default:
				this[key] = data[key];
			}
		}
	}

	onBeforeExpire(callback) {
		setTimeout(callback, Math.max(0, this.deletedTimestamp - Date.now() - 3e5))
	}

	onExpire(callback) {
		setTimeout(callback, Math.max(0, this.deletedTimestamp - Date.now()))
	}
}