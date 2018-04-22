import {
	APIGatewayProxyEvent,
	Handler,
	Context,
	Callback,
	ProxyResult,
} from "aws-lambda";
import * as AWS from "aws-sdk";
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
	language?: string;
}

const fonts = {
	"belwe/belwe-extrabold.ttf": {family: "Belwe"},
	"franklin-gothic-bold/FRADMCN.ttf": {
		family: "Franklin Gothic Bold",
		weight: "bold",
	},
	"franklin-gothic-italic/FRAMDIT.ttf": {
		family: "Franklin Gothic Italic",
		style: "italic",
	},
	"franklin-gothic-bolditalic/FRADMIT.ttf": {
		family: "Franklin Gothic Bold Italic",
		style: "italic",
		weight: "bold",
	},
	"franklin-gothic/FRAMDCN.ttf": {family: "Franklin Gothic"},
	"blizzard-global/BlizzardGlobal.ttf": {family: "BlizzardGlobal"},
	"blizzard-global/BlizzardGlobal-zhTW.ttf": {family: "BlizzardGlobal hant"},
	"leisu-demi-b5ar/Leisu-Demi-B5RegularAR.ttf": {family: "AR Leisu Demi B5"},
	"lisu-gb-medium/LisuGBMediumAR.ttf": {family: "Lisu GB Medium AR"},
	"benguiat-bold-itc/BNT85.ttf": {family: "BenguiatBoldITC"},
	"PSLAsadongProRegular/PSL025pro.ttf": {family: "PSL Asadong Pro Regular"},
	"PSLPaksinProRegular/PSL013pro.ttf": {family: "PSL Paksin Pro Regular"},
	"shuei-marugo/ShueiMGoL_20160225.ttf": {family: "Shuei MaruGo L"},
	"hanabotan/RAHanabotanBelDB_P.ttf": {family: "HanaBotan Bel DB"},
	"SapphIIM/YDISapphIIM.ttf": {family: "SapphIIM"},
	"2002L/2002.ttf": {family: "2002L"},
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

function onRender(canvas: any, key: string, callback: Callback) {
	const buf = canvas.toBuffer();
	const response: ProxyResult = {
		statusCode: 200,
		headers: {"content-type": "image/png"},
		body: buf.toString("base64"),
		isBase64Encoded: true,
	};

	if (key) {
		const s3 = new AWS.S3();
		console.log(`Saving image to ${key}...`);
		s3.putObject(
			{
				Bucket: "art.hearthstonejson.com",
				Key: key,
				Body: buf,
				ContentType: "image/png",
			},
			(err: any, data: any) => {
				if (err) {
					throw new Error(err);
				}

				return callback(undefined, response);
			}
		);
	} else {
		console.log("Not saving the results to S3");
		return callback(undefined, response);
	}
}

const handler: Handler = (
	event: APIGatewayProxyEvent,
	context: Context,
	callback: Callback
) => {
	let sunwell: Sunwell = new Sunwell({
		titleFont: "Belwe",
		bodyFontBold: "Franklin Gothic Bold",
		bodyFontItalic: "Franklin Gothic Italic",
		bodyFontBoldItalic: "Franklin Gothic Bold Italic",
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
	let templateId = params["template"];
	const resolution = parseInt(params["resolution"] || "512");
	const premium = params["premium"] === "true";
	const locale =
		SUPPORTED_LOCALES.indexOf(params["locale"]) !== -1
			? params["locale"]
			: DEFAULT_LOCALE;
	// const build = params["build"] || "latest";

	if (locale === "ruRU") {
		sunwell.options.titleFont = "BenguiatBoldITC";
	} else if (locale === "jaJP") {
		sunwell.options.titleFont = "HanaBotan Bel DB";
		sunwell.options.bodyFontBold = "Shuei MaruGo L";
		sunwell.options.bodyFontItalic = "Shuei MaruGo L";
		sunwell.options.bodyFontBoldItalic = "Shuei MaruGo L";
		sunwell.options.bodyFontRegular = "Shuei MaruGo L";
	} else if (locale === "koKR") {
		sunwell.options.titleFont = "SapphIIM";
		sunwell.options.bodyFontBold = "2002L";
		sunwell.options.bodyFontItalic = "2002L";
		sunwell.options.bodyFontBoldItalic = "2002L";
		sunwell.options.bodyFontRegular = "2002L";
		sunwell.options.bodyFontSize = 30;
	} else if (locale === "zhTW") {
		sunwell.options.titleFont = "AR Leisu Demi B5";
		sunwell.options.bodyFontBold = "BlizzardGlobal Hant";
		sunwell.options.bodyFontItalic = "BlizzardGlobal Hant";
		sunwell.options.bodyFontBoldItalic = "BlizzardGlobal Hant";
		sunwell.options.bodyFontRegular = "BlizzardGlobal Hant";
		sunwell.options.bodyFontSize = 30;
	} else if (locale === "zhCN") {
		sunwell.options.titleFont = "Lisu GB Medium AR";
		sunwell.options.bodyFontBold = "BlizzardGlobal";
		sunwell.options.bodyFontItalic = "BlizzardGlobal";
		sunwell.options.bodyFontBoldItalic = "BlizzardGlobal";
		sunwell.options.bodyFontRegular = "BlizzardGlobal";
		sunwell.options.bodyFontSize = 30;
	} else if (locale === "thTH") {
		sunwell.options.titleFont = "PSL Asadong Pro Regular";
		sunwell.options.bodyFontRegular = "PSL Paksin Pro Regular";
	}

	let texture: string;
	let uploadKey: string;
	let cardObj: SunwellCard;
	const format = "png"; // WebP? https://github.com/Automattic/node-canvas/issues/562

	const hsJson = JSON.parse(readFileSync(`${locale}.json`, "utf8"));
	if (!templateId) {
		let keys = Object.keys(hsJson);
		templateId = hsJson[keys[(keys.length * Math.random()) << 0]].id;
		console.log("Randomly picked", templateId);
	}

	if (templateId) {
		texture = `https://art.hearthstonejson.com/v1/orig/${templateId}.png`;

		for (let c of hsJson) {
			if (c.id == templateId) {
				cardObj = c;
				if (c.type === "ENCHANTMENT") {
					// Use a spell frame for enchantments
					cardObj.type = "SPELL";
				}
				cardObj.name = c.name;
				cardObj.text = c.collectionText || c.text;
				cardObj["collectionText"] = undefined;
				cardObj.text = c.text;
				cardObj.language = locale;

				uploadKey = `v1/render/latest/${locale}/${resolution}x/${
					c.id
				}.${format}`;
				break;
			}
		}
	} else {
		texture = "https://art.hearthstonejson.com/v1/orig/XXX_001.png";
		cardObj = {type: "SPELL"};
	}

	// register fonts

	const fontDir = `${__dirname}/hs-fonts`;
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
			return callback(undefined, {
				statusCode: 502,
				headers: {"content-type": "application/json"},
				body: JSON.stringify({
					error: "texture_not_found",
					detail: `Got ${statusCode} when attempting to download ${texture}`,
				}),
			});
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
				(canvas: any) => onRender(canvas, uploadKey, callback)
			);
		});
	});
};

export {handler};
