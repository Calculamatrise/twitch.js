import Base from "./Base.js";
import Channel from "./Channel.js";
import User from "./User.js";

export default class Message extends Base {
	id = null;
	author = null;
	content = null;
	channel = null;

	/**
	 * 
	 * @param {Client} client
	 * @param {object} data
	 */
	constructor(client, { command, parameters, tags }) {
		super(client);

		this.author = new User(...arguments);
		this.channel = new Channel(...arguments);
		this.content = (command !== null && command.botCommandParams) ?? parameters ?? this.content;
		if (typeof tags == "object" && tags !== null) {
			this.id = (tags["target-msg-id"] || tags.id) ?? this.id;
		}
	}

	/**
	 * Deletes this message from the chat
	 * @returns {Promise}
	 */
	delete() {
		if (`#${this.author.username}` === this.channel.name) {
			throw new Error("You cannot delete the broadcaster's messages.");
		} else if (this.channel.moderators.has(this.author.username)) {
			throw new Error(`You cannot delete messages from another moderator ${this.author.username}.`);
		}

		return this.client.deleteMessage(this.id, this.channel.name);
	}

	/**
	 * Sends a reply to this message
	 * @param {(string|object)} data
	 * @returns {Promise}
	 */
	reply(data) {
		return this.channel.send(data, { referenceId: this.id });
	}
}