import {
	APIGatewayEvent,
	Handler,
	Context,
	Callback,
	ProxyResult,
} from "aws-lambda";
import {Image, registerFont} from "canvas";
import {readFileSync} from "fs";
import * as https from "https";
import * as Sunwell from "sunwell";

interface SunwellCard {
	type: string;
	name?: string;
	text?: string;
	cardClass?: string;
	cost?: Number;
	texture?: Image;
}

const fonts = {
	"belwe/belwe-extrabold.ttf": {family: "Belwe"},
	"franklin-gothic-bold/franklingothic-demicd.ttf": {
		family: "Franklin Gothic Bold",
		weight: "bold",
	},
	"franklin-gothic-italic/franklingothic-medcdit.ttf": {
		family: "Franklin Gothic Italic",
		style: "italic",
	},
	"franklin-gothic/franklingothic-medcd.ttf": {family: "Franklin Gothic"},
};

const handler: Handler = (
	event: APIGatewayEvent,
	context: Context,
	callback: Callback
) => {
	let sunwell: Sunwell = new Sunwell({
		titleFont: "Belwe",
		bodyFontBold: "Franklin Gothic Bold",
		bodyFontItalic: "Franklin Gothic Italic",
		bodyFontBoldItalic: "Franklin Gothic Bold",
		bodyFontRegular: "Franklin Gothic",
		bodyFontSize: 38,
		bodyLineHeight: 40,
		bodyFontOffset: {x: 0, y: 26},
		assetFolder: `${__dirname}/node_modules/sunwell/dist/assets/`,
		cacheSkeleton: false,
	});
	sunwell.options.bodyLineStyle = "";

	const params = event.queryStringParameters || {};
	const templateId = params["template"];
	const resolution = parseInt(params["resolution"] || "512");
	const premium = params["premium"] === "true";
	// const build = params["build"] || "latest";

	let texture: string;
	let cardObj: SunwellCard;

	if (templateId) {
		texture = `https://art.hearthstonejson.com/v1/orig/${templateId}.png`;
		const hsJson = JSON.parse(readFileSync("cards.json", "utf8"));

		for (let c of hsJson) {
			if (c.id == templateId) {
				cardObj = c;
				break;
			}
		}
	} else {
		texture = "https://art.hearthstonejson.com/v1/orig/XXX_001.png";
		cardObj = {type: "SPELL"};
	}

	// register fonts

	for (let key of Object.keys(fonts)) {
		let font = fonts[key];
		/* let fontPath = path.join(args.font_dir, key);
		if (!fs.existsSync(fontPath)) {
			throw new Error(`Font not found: ${fontPath}`);
		} else {
			Canvas.registerFont(fontPath, font);
		} */

		registerFont(`${__dirname}/hs-fonts/${key}`, font);
	}

	// Download texture
	https.get(texture, res => {
		const {statusCode} = res;
		if (statusCode !== 200) {
			throw new Error("unexpected status code");
		}

		let data: any[] = [];
		res.on("data", chunk => {
			data.push(chunk);
		});

		res.on("end", () => {
			const buffer = Buffer.concat(data);

			// read texture, turn into an Image
			cardObj.texture = new Image();
			cardObj.texture.src = buffer;

			sunwell.createCard(
				cardObj,
				resolution,
				premium,
				null,
				(canvas: any) => {
					const buf = canvas.toBuffer();
					// writeFileSync("out.png", buf);

					const response: ProxyResult = {
						statusCode: 200,
						headers: {"Content-Type": "image/png"},
						body: buf.toString("base64"),
						isBase64Encoded: true,
					};

					callback(undefined, response);
				}
			);
		});
	});
};

export {handler};
