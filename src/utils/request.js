import http from "http";
import https from "https";

/**
 * 
 * @param {(String|Object)} url 
 * @param {Object} options 
 * @returns {Promise}
 */
export default function(url, options = {}) {
    if (typeof options != "object") {
        throw new TypeError("Options must be of type: Object");
    }

    if (typeof url == "string") {
        options = { ...options, url };
    } else if (typeof url == "object" && url !== null) {
        options = url;
    }

    options = {
        body: null,
        method: "GET", ...options,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': 0, ...options.headers
        }
    }

    let contentTypeKey = Object.keys(options.headers).find(key => /^content-type$/i.test(key));
    let contentType = options.headers[contentTypeKey];
    delete options.headers[contentTypeKey];
    options.headers['Content-Type'] = contentType;

    let parsedURL = new URL(options.url);
    let isSecure = /[^:]s/.test(parsedURL.protocol);

    options.host = parsedURL.host;
    options.hostname = parsedURL.hostname;
    options.pathname = parsedURL.pathname;
    options.path = parsedURL.path;

    return new Promise(function(resolve, reject) {
        (isSecure ? https : http).request(options, function(res) {
            const buffers = [];
            for await (const chunk of res) {
                buffers.push(chunk);
            }

            let data = Buffer.concat(buffers);
            if (contentType.startsWith("image/png")) {
                if (contentType.includes("base64")) {
                    data = 'data:image/png; base64, ' + data.toString("base64");
                }
                return void resolve(data);
            }

            res.once("error", reject);
            try {
                return void resolve(JSON.parse(data));
            } catch {}
            resolve(data.toString("utf8"));
        }).end(/^application\/json/.test(options.headers["Content-Type"]) ? JSON.stringify(options.body) : new URLSearchParams(options.body).toString());
    });
}