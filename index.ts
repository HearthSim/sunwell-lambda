import {
	APIGatewayEvent,
	Handler,
	Context,
	Callback,
	ProxyResult,
} from "aws-lambda";
import {Image, registerFont} from "canvas";
import {existsSync, readFileSync} from "fs";
import {join} from "path";
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
	"blizzard-global/BlizzardGlobal-zhTW.ttf": {family: "BlizzardGlobal"},
	"leisu-demi-b5ar/Leisu-Demi-B5RegularAR.ttf": {family: "AR Leisu Demi B5"},
};

const DEFAULT_LOCALE = "enUS";
const SUPPORTED_LOCALES = [
	"enUS",
	"frFR",
	"deDE",
	"koKR",
	"esES",
	"esMX",
	"ruRU",
	"zhTW",
	"zhCN",
	"itIT",
	"plPL",
	"ptBR",
	"jaJP",
	"thTH",
];

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
		gemFont: "Belwe",
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
	const locale =
		SUPPORTED_LOCALES.indexOf(params["locale"]) !== -1
			? params["locale"]
			: DEFAULT_LOCALE;
	// const build = params["build"] || "latest";

	if (locale === "zhTW") {
		sunwell.options.titleFont = "AR Leisu Demi B5";
		sunwell.options.bodyFontBold = "BlizzardGlobal";
		sunwell.options.bodyFontItalic = "BlizzardGlobal";
		sunwell.options.bodyFontBoldItalic = "BlizzardGlobal";
		sunwell.options.bodyFontRegular = "BlizzardGlobal";
	}

	let texture: string;
	let cardObj: SunwellCard;

	if (templateId) {
		texture = `https://art.hearthstonejson.com/v1/orig/${templateId}.png`;
		const hsJson = JSON.parse(readFileSync(`${locale}.json`, "utf8"));

		for (let c of hsJson) {
			if (c.id == templateId) {
				cardObj = c;
				cardObj.name = c.name;
				cardObj.text = c.collectionText || c.text;
				cardObj["collectionText"] = undefined;
				cardObj.text = c.text;
				break;
			}
		}
	} else {
		texture = "https://art.hearthstonejson.com/v1/orig/XXX_001.png";
		cardObj = {type: "SPELL"};
	}

	// register fonts

	const fontDir = `${__dirname}/hs-fonts`
	for (let key of Object.keys(fonts)) {
		let font = fonts[key];
		let fontPath = join(fontDir, key);
		if (!existsSync(fontPath)) {
			throw new Error(`Font not found: ${fontPath}`);
		}

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
