import { inspect } from "util";

/**
 * Style text
 * @param {String} text
 * @param {Object} [options]
 * @param {String} [options.color]
 * @param {String} [options.background]
 * @param {String} [options.foreground]
 * @param {Boolean} [options.reset]
 * @param {Boolean} [options.bold]
 * @param {Boolean} [options.italic]
 * @param {Boolean} [options.underline]
 * @param {Boolean} [options.strikethrough]
 * @param {Boolean} [options.crossedout]
 * @param {Boolean} [options.hidden]
 * @param {Boolean} [options.dim]
 * @param {Boolean} [options.overline]
 * @param {Boolean} [options.blink]
 * @param {Boolean} [options.inverse]
 * @param {Boolean} [options.doubleunderline]
 * @param {Boolean} [options.framed]
 * @param {Array<String>} options.modifiers
 * @returns {String}
 */
export default function(text, options) {
    if (options === void 0) {
        return `\x1b[${~~inspect.colors[text]?.at(0)}m`;
    }

    let filters = new Set();
    if (typeof options == "object") {
        for (const key in options) {
            if (typeof options[key] == "string") {
                let filter = inspect.colors[options[key].toLowerCase()];
                if (filter !== void 0) {
                    switch(key.toLowerCase()) {
                        case "background": {
                            filters.add(10 + filter.at(0));
                            break;
                        }

                        case "color":
                        case "foreground": {
                            filters.add(filter.at(0));
                            break;
                        }
                    }
                }
            } else {
                switch(key.toLowerCase()) {
                    case "reset":
                    case "bold":
                    case "italic":
                    case "underline":
                    case "strikethrough":
                    case "crossedout":
                    case "hidden":
                    case "dim":
                    case "overline":
                    case "blink":
                    case "inverse":
                    case "doubleunderline":
                    case "framed": {
                        let filter = inspect.colors[key.toLowerCase()];
                        if (filter !== void 0) {
                            filters.add(filter.at(1 - options[key]));
                        }
                    }

                    case "modifiers": {
                        if (typeof options[key] == "object") {
                            for (const mod of options[key]) {
                                let filter = inspect.colors[mod];
                                if (filter !== void 0) {
                                    filters.add(filter.at(0));
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
    }

    if (filters.size === 0) {
        return text;
    }

    return `\x1b[${Array.from(filters.values()).map(filter => `${filter}m`).join('\x1b[')}${text}\x1b[0m`;
}