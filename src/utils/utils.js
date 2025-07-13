const ircEscapedChars = { s: ' ', n: '', ':': ';', r: '' };
const ircUnescapedChars = { ' ': 's', '\n': 'n', ';': ':', '\r': 'r' };
export default {
	// http://ircv3.net/specs/core/message-tags-3.2.html#escaping-values
	unescapeIRC(msg) {
		if(!msg || typeof msg !== 'string' || !msg.includes('\\')) return msg;
		return msg.replace(/\\([sn:r\\])/g, (m, p) => p in ircEscapedChars ? ircEscapedChars[p] : p);
	},
	escapeIRC(msg) {
		if(!msg || typeof msg !== 'string') return msg;
		return msg.replace(/([ \n;\r\\])/g, (m, p) => p in ircUnescapedChars ? `\\${ircUnescapedChars[p]}` : p);
	}
}
