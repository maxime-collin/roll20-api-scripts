// ChatSetAttr version 1.8
// Last Updated: 2018-07-15
// A script to create, modify, or delete character attributes from the chat area or macros.
// If you don't like my choices for --replace, you can edit the replacers variable at your own peril to change them.

/* global log, state, globalconfig, getObj, sendChat, _, getAttrByName, findObjs, createObj, playerIsGM, on */
var chatSetAttr = chatSetAttr || (function () {
	"use strict";
	const version = "1.8",
		schemaVersion = 3,
		replacers = [
			[/</g, "["],
			[/\\lbrak/g, "["],
			[/>/g, "]"],
			[/\\rbrak/g, "]"],
			[/;/g, "?"],
			[/\\ques/g, "?"],
			[/`/g, "@"],
			[/\\at/g, "@"],
			[/\\n/g, "\n"],
		],
		// Basic Setup
		checkInstall = function () {
			log(`-=> ChatSetAttr v${version} <=-`);
			if (!state.ChatSetAttr || state.ChatSetAttr.version !== schemaVersion) {
				log(` > Updating ChatSetAttr Schema to v${schemaVersion} <`);
				state.ChatSetAttr = {
					version: schemaVersion,
					globalconfigCache: {
						lastsaved: 0
					},
					playersCanModify: false,
					playersCanEvaluate: false,
					useWorkers: true
				};
			}
			checkGlobalConfig();
		},
		checkGlobalConfig = function () {
			const s = state.ChatSetAttr,
				g = globalconfig && globalconfig.chatsetattr;
			if (g && g.lastsaved && g.lastsaved > s.globalconfigCache.lastsaved) {
				log(" > Updating ChatSetAttr from Global Config < [" +
					(new Date(g.lastsaved * 1000)) + "]");
				s.playersCanModify = "playersCanModify" === g["Players can modify all characters"];
				s.playersCanEvaluate = "playersCanEvaluate" === g["Players can use --evaluate"];
				s.useWorkers = "useWorkers" === g["Trigger sheet workers when setting attributes"];
				s.globalconfigCache = globalconfig.chatsetattr;
			}
		},
		// Utility functions
		isDef = function (value) {
			return value !== undefined;
		},
		getWhisperPrefix = function (playerid) {
			const player = getObj("player", playerid);
			if (player && player.get("_displayname")) {
				return "/w \"" + player.get("_displayname") + "\" ";
			} else {
				return "/w GM ";
			}
		},
		sendChatMessage = function (msg, from) {
			if (from === undefined) from = "ChatSetAttr";
			sendChat(from, msg, null, {
				noarchive: true
			});
		},
		setAttribute = function (attr, value) {
			if (state.ChatSetAttr.useWorkers) attr.setWithWorker(value);
			else attr.set(value);
		},
		handleErrors = function (whisper, errors) {
			if (errors.length) {
				const output = whisper +
					"<div style=\"border:1px solid black;background-color:#FFBABA;padding:3px\">" +
					"<h4>Errors</h4>" +
					`<p>${errors.join("<br>")}</p>` +
					"</div>";
				sendChatMessage(output);
				errors.splice(0, errors.length);
			}
		},
		showConfig = function (whisper) {
			const optionsText = [{
					name: "playersCanModify",
					command: "players-can-modify",
					desc: "Determines if players can use <i>--name</i> and <i>--charid</i> to " +
						"change attributes of characters they do not control."
				}, {
					name: "playersCanEvaluate",
					command: "players-can-evaluate",
					desc: "Determines if players can use the <i>--evaluate</i> option. <b>" +
						"Be careful</b> in giving players access to this option, because " +
						"it potentially gives players access to your full API sandbox."
				}, {
					name: "useWorkers",
					command: "use-workers",
					desc: "Determines if setting attributes should trigger sheet worker operations."
				}].map(getConfigOptionText).join(""),
				output = whisper + "<div style=\"border: 1px solid black; background-color: #FFFFFF;" +
				"padding:3px;\"><b>ChatSetAttr Configuration</b><div style=\"padding-left:10px;\">" +
				"<p><i>!setattr-config</i> can be invoked in the following format: </p><pre style=\"" +
				"white-space:normal;word-break:normal;word-wrap:normal;\">!setattr-config --option</pre>" +
				"<p>Specifying an option toggles the current setting. There are currently two" +
				" configuration options:</p>" + optionsText + "</div></div>";
			sendChatMessage(output);
		},
		getConfigOptionText = function (o) {
			const button = state.ChatSetAttr[o.name] ?
				"<span style=\"color:red;font-weight:bold;padding:0px 4px;\">ON</span>" :
				"<span style=\"color:#999999;font-weight:bold;padding:0px 4px;\">OFF</span>";
			return "<div style=\"padding-left:10px;padding-right:20px\"><ul>" +
				"<li style=\"border-top:1px solid #ccc;border-bottom:1px solid #ccc;\">" +
				"<div style=\"float:right;width:40px;border:1px solid black;" +
				`background-color:#ffc;text-align:center;">${button}</div><b>` +
				`<span style="font-family: serif;">${o.command}</span></b>${htmlReplace("-")}` +
				`${o.desc}</li></ul></div><div><b>${o.name}</b> is currently ${button}` +
				`<a href="!setattr-config --${o.command}">Toggle</a></div>`;
		},
		getCharNameById = function (id) {
			const character = getObj("character", id);
			return (character) ? character.get("name") : "";
		},
		escapeRegExp = function (str) {
			return str.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
		},
		htmlReplace = function (str) {
			const entities = {
				"<": "lt",
				">": "gt",
				"'": "#39",
				"*": "#42",
				"@": "#64",
				"{": "#123",
				"|": "#124",
				"}": "#125",
				"[": "#91",
				"]": "#93",
				"_": "#95",
				"\"": "quot"
			};
			return String(str).split("").map(c => (entities[c]) ? ("&" + entities[c] + ";") : c).join("");
		},
		processInlinerolls = function (msg) {
			if (msg.inlinerolls && msg.inlinerolls.length) {
				return msg.inlinerolls.map(v => {
					const ti = v.results.rolls.filter(v2 => v2.table)
						.map(v2 => v2.results.map(v3 => v3.tableItem.name).join(", "))
						.join(", ");
					return (ti.length && ti) || v.results.total || 0;
				})
					.reduce((m, v, k) => m.replace(`$[[${k}]]`, v), msg.content);
			} else {
				return msg.content;
			}
		},
		notifyAboutDelay = function (whisper) {
			const chatFunction = () => sendChatMessage(whisper + "Your command is taking a " +
				"long time to execute. Please be patient, the process will finish eventually.");
			return setTimeout(chatFunction, 8000);
		},
		getCIKey = function (obj, name) {
			const nameLower = name.toLowerCase();
			let result = false;
			Object.entries(obj).forEach(([k, ]) => {
				if (k.toLowerCase() === nameLower) {
					result = k;
				}
			});
			return result;
		},
		generateUUID = function () {
			var a = 0,
				b = [];
			return function () {
				var c = (new Date()).getTime() + 0,
					d = c === a;
				a = c;
				for (var e = new Array(8), f = 7; 0 <= f; f--) {
					e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64);
					c = Math.floor(c / 64);
				}
				c = e.join("");
				if (d) {
					for (f = 11; 0 <= f && 63 === b[f]; f--) {
						b[f] = 0;
					}
					b[f]++;
				} else {
					for (f = 0; 12 > f; f++) {
						b[f] = Math.floor(64 * Math.random());
					}
				}
				for (f = 0; 12 > f; f++) {
					c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
				}
				return c;
			};
		}(),
		generateRowID = function () {
			return generateUUID().replace(/_/g, "Z");
		},
		// Setting attributes happens in a delayed recursive way to prevent the sandbox
		// from overheating.
		delayedGetAndSetAttributes = function (whisper, list, setting, errors, rData, opts) {
			const timeNotification = notifyAboutDelay(whisper),
				cList = [].concat(list),
				feedback = [],
				dWork = function (charid) {
					const attrs = getCharAttributes(charid, setting, errors, rData, opts);
					setCharAttributes(charid, setting, errors, feedback, attrs, opts);
					if (cList.length) {
						setTimeout(dWork, 50, cList.shift());
					} else {
						clearTimeout(timeNotification);
						if (!opts.mute) handleErrors(whisper, errors);
						if (!opts.silent) sendFeedback(whisper, feedback, opts);
					}
				};
			dWork(cList.shift());
		},
		setCharAttributes = function (charid, setting, errors, feedback, attrs, opts) {
			const charFeedback = {};
			Object.entries(attrs).forEach(([attrName, attr]) => {
				let newValue;
				charFeedback[attrName] = {};
				const fillInAttrs = setting[attrName].fillin,
					settingValue = _.pick(setting[attrName], ["current", "max"]);
				if (opts.reset) {
					newValue = {
						current: attr.get("max")
					};
				} else {
					newValue = (fillInAttrs) ?
						_.mapObject(settingValue, v => fillInAttrValues(charid, v)) : Object.assign({}, settingValue);
				}
				if (opts.evaluate) {
					try {
						newValue = _.mapObject(newValue, function (v) {
							const parsed = eval(v);
							if (_.isString(parsed) || Number.isFinite(parsed) || _.isBoolean(parsed)) {
								return parsed.toString();
							} else return v;
						});
					} catch (err) {
						errors.push("Something went wrong with --evaluate" +
							` for the character ${getCharNameById(charid)}.` +
							` You were warned. The error message was: ${err}.` +
							` Attribute ${attrName} left unchanged.`);
						return;
					}
				}
				if (opts.mod || opts.modb) {
					Object.entries(newValue).forEach(([k, v]) => {
						let moddedValue = parseFloat(v) + parseFloat(attr.get(k) || "0");
						if (!_.isNaN(moddedValue)) {
							if (opts.modb && k === "current") {
								moddedValue = Math.min(Math.max(moddedValue, 0), parseFloat(attr.get("max")) || Infinity);
							}
							newValue[k] = moddedValue;
						} else {
							delete newValue[k];
							const type = (k === "max") ? "maximum " : "";
							errors.push(`Attribute ${type}${attrName} is not number-valued for ` +
								`character ${getCharNameById(charid)}. Attribute ${type}left unchanged.`);
						}
					});
				}
				newValue = _.mapObject(newValue, v => String(v));
				charFeedback[attrName] = newValue;
				setAttribute(attr, newValue);
			});
			// Feedback
			if (!opts.silent) {
				if ("fb-content" in opts) {
					const finalFeedback = Object.entries(setting).reduce((m, [attrName, value], k) => {
						if (!charFeedback[attrName]) return m;
						else return m.replace(`_NAME${k}_`, attrName)
							.replace(`_TCUR${k}_`, htmlReplace(value.current || ""))
							.replace(`_TMAX${k}_`, htmlReplace(value.max || ""))
							.replace(`_CUR${k}_`, htmlReplace(charFeedback[attrName].current || ""))
							.replace(`_MAX${k}_`, htmlReplace(charFeedback[attrName].max || ""));
					}, String(opts["fb-content"]).replace("_CHARNAME_", getCharNameById(charid)))
						.replace(/_(?:TCUR|TMAX|CUR|MAX|NAME)\d*_/g, "");
					feedback.push(finalFeedback);
				} else {
					const finalFeedback = Object.entries(charFeedback).map(([k, o]) => {
						if ("max" in o && "current" in o)
							return `${k} to ${htmlReplace(o.current) || "<i>(empty)</i>"} / ${htmlReplace(o.max) || "<i>(empty)</i>"}`;
						else if ("current" in o) return `${k} to ${htmlReplace(o.current) || "<i>(empty)</i>"}`;
						else if ("max" in o) return `${k} to ${htmlReplace(o.max) || "<i>(empty)</i>"} (max)`;
						else return null;
					}).filter(x => !!x).join(", ").replace(/\n/g, "<br>");
					if (finalFeedback.length) {
						feedback.push(`Setting ${finalFeedback} for character ${getCharNameById(charid)}.`);
					} else {
						feedback.push(`Nothing to do for character ${getCharNameById(charid)}.`);
					}
				}
			}
			return;
		},
		fillInAttrValues = function (charid, expression) {
			let match = expression.match(/%(\S.*?)(?:_(max))?%/),
				replacer;
			while (match) {
				replacer = getAttrByName(charid, match[1], match[2] || "current") || "";
				expression = expression.replace(/%(\S.*?)(?:_(max))?%/, replacer);
				match = expression.match(/%(\S.*?)(?:_(max))?%/);
			}
			return expression;
		},
		// Getting attributes for a specific character
		getCharAttributes = function (charid, setting, errors, rData, opts) {
			const standardAttrNames = Object.keys(setting).filter(x => !setting[x].repeating),
				rSetting = _.omit(setting, standardAttrNames);
			return Object.assign({},
				getCharStandardAttributes(charid, standardAttrNames, errors, opts),
				getCharRepeatingAttributes(charid, rSetting, errors, rData, opts)
			);
		},
		getCharStandardAttributes = function (charid, attrNames, errors, opts) {
			const attrs = {},
				attrNamesUpper = attrNames.map(x => x.toUpperCase());
			if (attrNames.length === 0) return {};
			findObjs({
				_type: "attribute",
				_characterid: charid
			}).forEach(attr => {
				const nameIndex = attrNamesUpper.indexOf(attr.get("name").toUpperCase());
				if (nameIndex !== -1) attrs[attrNames[nameIndex]] = attr;
			});
			_.difference(attrNames, Object.keys(attrs)).forEach(key => {
				if (!opts.nocreate && !opts.deletemode) {
					attrs[key] = createObj("attribute", {
						characterid: charid,
						name: key
					});
				} else if (!opts.deletemode) {
					errors.push(`Missing attribute ${key} not created for` +
						` character ${getCharNameById(charid)}.`);
				}
			});
			return attrs;
		},
		getCharRepeatingAttributes = function (charid, setting, errors, rData, opts) {
			const allRepAttrs = {},
				attrs = {},
				repRowIds = {},
				repOrders = {};
			if (rData.sections.size === 0) return {};
			rData.sections.forEach(prefix => allRepAttrs[prefix] = {});
			// Get attributes
			findObjs({
				_type: "attribute",
				_characterid: charid
			}).forEach(o => {
				const attrName = o.get("name");
				rData.sections.forEach((prefix, k) => {
					if (attrName.search(rData.regExp[k]) === 0) {
						allRepAttrs[prefix][attrName] = o;
					} else if (attrName === "_reporder_" + prefix) {
						repOrders[prefix] = o.get("current").split(",");
					}
				});
			});
			// Get list of repeating row ids by prefix from allRepAttrs
			rData.sections.forEach((prefix, k) => {
				repRowIds[prefix] = [...new Set(Object.keys(allRepAttrs[prefix])
					.map(n => n.match(rData.regExp[k]))
					.filter(x => !!x)
					.map(a => a[1]))];
				if (repOrders[prefix]) {
					repRowIds[prefix] = _.chain(repOrders[prefix])
						.intersection(repRowIds[prefix])
						.union(repRowIds[prefix])
						.value();
				}
			});
			const repRowIdsLo = _.mapObject(repRowIds, l => l.map(n => n.toLowerCase()));
			rData.toCreate.forEach(prefix => repRowIds[prefix].push(generateRowID()));
			Object.entries(setting).forEach(([attrName, value]) => {
				const p = value.repeating;
				let finalId;
				if (isDef(p.rowNum) && isDef(repRowIds[p.splitName[0]][p.rowNum])) {
					finalId = repRowIds[p.splitName[0]][p.rowNum];
				} else if (p.rowIdLo === "-create" && !opts.deletemode) {
					finalId = repRowIds[p.splitName[0]][repRowIds[p.splitName[0]].length - 1];
				} else if (isDef(p.rowIdLo) && repRowIdsLo[p.splitName[0]].includes(p.rowIdLo)) {
					finalId = repRowIds[p.splitName[0]][repRowIdsLo[p.splitName[0]].indexOf(p.rowIdLo)];
				} else if (isDef(p.rowNum)) {
					errors.push(`Repeating row number ${p.rowNum} invalid for` +
						` character ${getCharNameById(charid)}` +
						` and repeating section ${p.splitName[0]}.`);
				} else {
					errors.push(`Repeating row id ${p.rowIdLo} invalid for` +
						` character ${getCharNameById(charid)}` +
						` and repeating section ${p.splitName[0]}.`);
				}
				if (finalId && p.rowMatch) {
					const repRowUpper = (p.splitName[0] + "_" + finalId).toUpperCase();
					Object.entries(allRepAttrs[p.splitName[0]]).forEach(([name, attr]) => {
						if (name.toUpperCase().indexOf(repRowUpper) === 0) {
							attrs[name] = attr;
						}
					});
				} else if (finalId) {
					const finalName = p.splitName[0] + "_" + finalId + "_" + p.splitName[1],
						attrNameCased = getCIKey(allRepAttrs[p.splitName[0]], finalName);
					if (attrNameCased) {
						attrs[attrName] = allRepAttrs[p.splitName[0]][attrNameCased];
					} else if (!opts.nocreate && !opts.deletemode) {
						attrs[attrName] = createObj("attribute", {
							characterid: charid,
							name: finalName
						});
					} else if (!opts.deletemode) {
						errors.push(`Missing attribute ${finalName} not created` +
							` for character ${getCharNameById(charid)}.`);
					}
				}
			});
			return attrs;
		},
		// Deleting attributes
		delayedDeleteAttributes = function (whisper, list, setting, errors, rData, opts) {
			const timeNotification = notifyAboutDelay(whisper),
				cList = [].concat(list),
				feedback = {},
				dWork = function (charid) {
					const attrs = getCharAttributes(charid, setting, errors, rData, opts);
					feedback[charid] = [];
					deleteCharAttributes(charid, attrs, feedback);
					if (cList.length) {
						setTimeout(dWork, 50, cList.shift());
					} else {
						clearTimeout(timeNotification);
						if (!opts.silent) sendDeleteFeedback(whisper, feedback, opts);
					}
				};
			dWork(cList.shift());
		},
		deleteCharAttributes = function (charid, attrs, feedback) {
			Object.keys(attrs).forEach(name => {
				attrs[name].remove();
				feedback[charid].push(name);
			});
		},
		// These functions parse the chat input.
		parseOpts = function (content, hasValue) {
			// Input:	content - string of the form command --opts1 --opts2  value --opts3.
			//					values come separated by whitespace.
			//			hasValue - array of all options which come with a value
			// Output:	object containing key:true if key is not in hasValue. and containing
			//			key:value otherwise
			return content.replace(/<br\/>/g, "") // delete added HTML line breaks
				.replace(/\s+$/g, "") // delete trailing whitespace
				.replace(/\s*{{((?:.|\n)*)\s+}}$/, " $1") // replace content wrapped in curly brackets
				.replace(/\\([{}])/g, "$1") // add escaped brackets
				.split(/\s+--/)
				.slice(1)
				.reduce((m, arg) => {
					const kv = arg.split(/\s(.+)/);
					if (hasValue.includes(kv[0])) {
						m[kv[0]] = kv[1] || "";
					} else {
						m[arg] = true;
					}
					return m;
				}, {});
		},
		parseAttributes = function (args, opts, errors) {
			// Input:	args - array containing comma-separated list of strings, every one of which contains
			//				an expression of the form key|value or key|value|maxvalue
			//			replace - true if characters from the replacers array should be replaced
			// Output:	Object containing key|value for all expressions.
			const globalRepeatingData = {
					regExp: new Set(),
					toCreate: new Set(),
					sections: new Set(),
				},
				setting = args.map(str => {
					return str.split(/(\\?(?:#|\|))/g)
						.reduce((m, s) => {
							if ((s === "#" || s === "|")) m[m.length] = "";
							else if ((s === "\\#" || s === "\\|")) m[m.length - 1] += s.slice(-1);
							else m[m.length - 1] += s;
							return m;
						}, [""]);
				})
					.filter(v => !!v)
				// Replace for --replace
					.map(arr => {
						return arr.map((str, k) => {
							if (opts.replace && k > 0) return replacers.reduce((m, rep) => m.replace(rep[0], rep[1]), str);
							else return str;
						});
					})
				// parse out current/max value
					.map(arr => {
						const value = {};
						if (arr.length < 3 || arr[1] !== "") {
							value.current = (arr[1] || "").replace(/^'((?:.|\n)*)'$/, "$1");
						}
						if (arr.length > 2) {
							value.max = arr[2].replace(/^'((?:.|\n)*)'$/, "$1");
						}
						return [arr[0], value];
					})
				// Find out if we need to run %_% replacement
					.map(([name, value]) => {
						if ((value.current && value.current.search(/%(\S.*?)(?:_(max))?%/) !== -1) ||
						(value.max && value.max.search(/%(\S.*?)(?:_(max))?%/) !== -1)) value.fillin = true;
						else value.fillin = false;
						return [name, value];
					})
				// Do repeating section stuff
					.map(([name, value]) => {
						if (name.search(/^repeating_/) === 0) {
							value.repeating = getRepeatingData(name, globalRepeatingData, opts, errors);
						} else value.repeating = false;
						return [name, value];
					})
					.filter(([, value]) => value.repeating !== null)
					.reduce((p, c) => {
						p[c[0]] = Object.assign(p[c[0]] || {}, c[1]);
						return p;
					}, {});
			globalRepeatingData.sections.forEach(s => {
				globalRepeatingData.regExp.add(new RegExp(`^${escapeRegExp(s)}_(-[-A-Za-z0-9]+?|\\d+)_`, "i"));
			});
			globalRepeatingData.regExp = [...globalRepeatingData.regExp];
			globalRepeatingData.toCreate = [...globalRepeatingData.toCreate];
			globalRepeatingData.sections = [...globalRepeatingData.sections];
			return [setting, globalRepeatingData];
		},
		getRepeatingData = function (name, globalData, opts, errors) {
			const match = name.match(/_(\$\d+|-[-A-Za-z0-9]+|\d+)(_)?/);
			let output = {};
			if (match && match[1][0] === "$" && match[2] === "_") {
				output.rowNum = parseInt(match[1].slice(1));
			} else if (match && match[2] === "_") {
				output.rowId = match[1];
				output.rowIdLo = match[1].toLowerCase();
			} else if (match && match[1][0] === "$" && opts.deletemode) {
				output.rowNum = parseInt(match[1].slice(1));
				output.rowMatch = true;
			} else if (match && opts.deletemode) {
				output.rowId = match[1];
				output.rowIdLo = match[1].toLowerCase();
				output.rowMatch = true;
			} else {
				errors.push(`Could not understand repeating attribute name ${name}.`);
				output = null;
			}
			if (output) {
				output.splitName = name.split(match[0]);
				globalData.sections.add(output.splitName[0]);
				if (output.rowIdLo === "-create" && !opts.deletemode) {
					globalData.toCreate.add(output.splitName[0]);
				}
			}
			return output;
		},
		// These functions are used to get a list of character ids from the input,
		// and check for permissions.
		checkPermissions = function (list, errors, playerid, isGM) {
			return list.filter(id => {
				const character = getObj("character", id);
				if (character) {
					const control = character.get("controlledby").split(/,/);
					if (!(isGM || control.includes("all") || control.includes(playerid) || state.ChatSetAttr.playersCanModify)) {
						errors.push(`Permission error for character ${character.get("name")}.`);
						return false;
					} else return true;
				} else {
					errors.push(`Invalid character id ${id}.`);
					return false;
				}
			});
		},
		getIDsFromTokens = function (selected) {
			return (selected || []).map(obj => getObj("graphic", obj._id))
				.filter(x => !!x)
				.map(token => token.get("represents"))
				.filter(id => getObj("character", id || ""));
		},
		getIDsFromNames = function (charNames, errors) {
			return charNames.split(/\s*,\s*/)
				.map(name => {
					const character = findObjs({
						_type: "character",
						name: name
					}, {
						caseInsensitive: true
					})[0];
					if (character) {
						return character.id;
					} else {
						errors.push(`No character named ${name} found.`);
						return null;
					}
				})
				.filter(x => !!x);
		},
		sendFeedback = function (whisper, feedback, opts) {
			const output = (opts["fb-public"] ? "" : whisper) +
				"<div style=\"border:1px solid black;background-color:#FFFFFF;padding:3px;\">" +
				"<h3>" + (("fb-header" in opts) ? opts["fb-header"] : "Setting attributes") + "</h3><p>" +
				"<p>" + (feedback.join("<br>") || "Nothing to do.") + "</p></div>";
			sendChatMessage(output, opts["fb-from"]);
		},
		sendDeleteFeedback = function (whisper, feedback, opts) {
			let output = (opts["fb-public"] ? "" : whisper) +
				"<div style=\"border:1px solid black;background-color:#FFFFFF;padding:3px;\">" +
				"<h3>" + (("fb-header" in opts) ? opts["fb-header"] : "Deleting attributes") + "</h3><p>";
			output += Object.entries(feedback)
				.filter(([, arr]) => arr.length)
				.map(([charid, arr]) => `Deleting attribute(s) ${arr.join(", ")} for character ${getCharNameById(charid)}.`)
				.join("<br>") || "Nothing to do.";
			output += "</p></div>";
			sendChatMessage(output, opts["fb-from"]);
		},
		handleCommand = (content, playerid, selected, pre) => {
			// Parsing input
			let charIDList = [],
				errors = [];
			const hasValue = ["charid", "name", "fb-header", "fb-content", "fb-from"],
				optsArray = ["all", "allgm", "charid", "name", "allplayers", "sel", "deletemode",
					"replace", "nocreate", "mod", "modb", "evaluate", "silent", "reset", "mute",
					"fb-header", "fb-content", "fb-from", "fb-public"
				],
				opts = parseOpts(content, hasValue),
				isGM = playerid === "API" || playerIsGM(playerid),
				whisper = getWhisperPrefix(playerid);
			opts.mod = opts.mod || (pre === "mod");
			opts.modb = opts.modb || (pre === "modb");
			opts.reset = opts.reset || (pre === "reset");
			opts.silent = opts.silent || opts.mute;
			opts.deletemode = (pre === "del");
			// Sanitise feedback
			if ("fb-from" in opts) opts["fb-from"] = String(opts["fb-from"]);
			// Parse desired attribute values
			const [setting, rData] = parseAttributes(Object.keys(_.omit(opts, optsArray)), opts, errors);
			// Fill in header info
			if ("fb-header" in opts) {
				opts["fb-header"] = Object.entries(setting).reduce((m, [n, v], k) => {
					return m.replace(`_NAME${k}_`, n)
						.replace(`_TCUR${k}_`, htmlReplace(v.current || ""))
						.replace(`_TMAX${k}_`, htmlReplace(v.max || ""));
				}, String(opts["fb-header"])).replace(/_(?:TCUR|TMAX|NAME)\d*_/g, "");
			}
			if (opts.evaluate && !isGM && !state.ChatSetAttr.playersCanEvaluate) {
				if (!opts.mute) handleErrors(whisper, ["The --evaluate option is only available to the GM."]);
				return;
			}
			// Get list of character IDs
			if (opts.all && isGM) {
				charIDList = findObjs({
					_type: "character"
				}).map(c => c.id);
			} else if (opts.allgm && isGM) {
				charIDList = findObjs({
					_type: "character"
				}).filter(c => c.get("controlledby") === "")
					.map(c => c.id);
			} else if (opts.allplayers && isGM) {
				charIDList = findObjs({
					_type: "character"
				}).filter(c => c.get("controlledby") !== "")
					.map(c => c.id);
			} else {
				if (opts.charid) charIDList.push(...opts.charid.split(/\s*,\s*/));
				if (opts.name) charIDList.push(...getIDsFromNames(opts.name, errors));
				if (opts.sel) charIDList.push(...getIDsFromTokens(selected));
				charIDList = checkPermissions([...new Set(charIDList)], errors, playerid, isGM);
			}
			if (charIDList.length === 0) {
				errors.push("No target characters. You need to supply one of --all, --allgm, --sel," +
					" --allplayers, --charid, or --name.");
			}
			if (Object.keys(setting).length === 0) {
				errors.push("No attributes supplied.");
			}
			// Get attributes
			if (!opts.mute) handleErrors(whisper, errors);
			// Set or delete attributes
			if (charIDList.length > 0 && Object.keys(setting).length > 0) {
				if (opts.deletemode) {
					delayedDeleteAttributes(whisper, charIDList, setting, errors, rData, opts);
				} else {
					delayedGetAndSetAttributes(whisper, charIDList, setting, errors, rData, opts);
				}
			}
		},
		handleInlineCommand = (msg) => {
			const command = msg.content.match(/!(set|mod|modb)attr .*?!!!/);

			if (command) {
				const mode = command[1],
					newMsgContent = command[0].slice(0, -3).replace(/{{[^}[\]]+\$\[\[(\d+)\]\].*?}}/g, (_, number) => {
						return `$[[${number}]]`;
					});
				const newMsg = {
					content: newMsgContent,
					inlinerolls: msg.inlinerolls,
				};
				handleCommand(
					processInlinerolls(newMsg),
					msg.playerid,
					msg.selected,
					mode
				);
			}
		},
		// Main function, called after chat message input
		handleInput = function (msg) {
			if (msg.type !== "api") handleInlineCommand(msg);
			else {
				const mode = msg.content.match(/^!(reset|set|del|mod|modb)attr\b(?:-|\s|$)(config)?/);

				if (mode && mode[2]) {
					if (playerIsGM(msg.playerid)) {
						const whisper = getWhisperPrefix(msg.playerid),
							opts = parseOpts(msg.content, []);
						if (opts["players-can-modify"]) {
							state.ChatSetAttr.playersCanModify = !state.ChatSetAttr.playersCanModify;
						}
						if (opts["players-can-evaluate"]) {
							state.ChatSetAttr.playersCanEvaluate = !state.ChatSetAttr.playersCanEvaluate;
						}
						if (opts["use-workers"]) {
							state.ChatSetAttr.useWorkers = !state.ChatSetAttr.useWorkers;
						}
						showConfig(whisper);
					}
				} else if (mode) {
					handleCommand(
						processInlinerolls(msg),
						msg.playerid,
						msg.selected,
						mode[1]
					);
				}
			}
			return;
		},
		registerEventHandlers = function () {
			on("chat:message", handleInput);
		};
	return {
		CheckInstall: checkInstall,
		RegisterEventHandlers: registerEventHandlers
	};
}());
on("ready", function () {
	"use strict";
	chatSetAttr.CheckInstall();
	chatSetAttr.RegisterEventHandlers();
});

on('chat:message',function(msg)
{
    //parse the message type
    if(msg.type != 'api')
    	return;
    
    var parts = msg.content.toLowerCase().split(' ');
    log( 'parts: '+parts);
    var command = parts.shift().substring(1); //remove the !
    
    if(command == 'exportattrs')
    {
    	var name = "";
    	var output = "";
    	var who = "";
    	
		//loop through the remaining parts for flags and other mods
        _.each(parts,function(curPart)
		{
            switch (curPart)
            {
            	default :
            		if (curPart.includes(":"))
                   	{
                       	curPartVal = curPart.split(":");
                       	
                       	switch(curPartVal[0])
                       	{                        			
                       		case "name":
                       			name = curPartVal[1];
                       			break;
                       	}
                   	}
            }
        });
                
        var characters = findObjs({_type: 'character'});
        var character;
        characters.forEach(function(chr)
		{
        	if(chr.get('name').toLowerCase() == name)
        		character = chr;
    	});
        
        var attrs = getAttrByName(character.id, "export_text");
        
        output += "{\\n    attrs: " + attrs; 
        
        output += ',\\n    character: {';
		output += "avatar: '" + character.get('avatar') + "'";
		
		character.get('bio', function(bio)
		{
			output += ", bio: '" + bio.replace(/'/g, "\\'").replace(/(<[^<>]*>)/g, " ") + "'";
			
			character.get('gmnotes', function(gmNotes)
			{
				output += ", gmnotes: '" + gmNotes.replace(/'/g, "\\'").replace(/(<[^<>]*>)/g, " ") + "'}";
				
				character.get('defaulttoken', function(tokenJSON)
				{
					token = JSON.parse(tokenJSON);
					if (token == null)
						token = {imgsrc: "", width: 70, height: 70};
					output += ",\\n    token: {imgsrc: '" + token.imgsrc + "'";
					output += ", width: " + token.width + ", height:" + token.height + ", layer: 'objects'}";
				});
			});
		});

		output += '\\n';
		output = output
						.replace(/\|/g, "\\|")
						.replace(/\#/g, "\\#")
						.replace(/@({[^@]*})/g, "\\at$1")
						;
		
		
		log("output is : " + output);
        sendChat(who, "!setattr --replace --name " + character.get('name') + " --export_text|"+output+"}");
    }
});

/** Evaluate a mathematical expression.
 * 
 * Beware ! eval() function used  
 * 
 * @param exprStr 	: String, the expression to evaluate
 * 
 * @returns Number, the result of expression
 */
function evaluateExpr(exprStr)
{
	log("expr : " + exprStr);
	expr = exprStr
			.replace(/abs/g,"Math.abs")
			.replace(/floor/g,"Math.floor")
			.replace(/ceil/g,"Math.ceil")
			.replace(/round/g,"Math.round"); // in the sheet, the Math. prefix is not needed but for eval() function it's
	log("fix expr : " + expr);
	result = eval(expr);
	log("result: " + result);
	return result;
}

/** Roll 1d10 with the Anima Characteristic's system (V1 or V2).
 * 
 * @param charVal 		: Number, the value of Characteristic
 * @param testCharV1	: Boolean, true if you want use the V1 of system (a dice below characteristic) or false for the V2 (a dice + characteristic)
 * @param mod 			: Number, a modifier to characteristic
 * 
 * @returns String, the output to sendChat
 */
function testCharacteristic(charVal, testCharV1, mod)
{
	var outputChar = "";
	log ("characteristic test : " + charVal);
	dice = randomInteger(10); 		// Roll 1d10.
	log('Dice roll : '+dice);
	
	total = charVal + mod;
	
	if (testCharV1) // V1 system : a dice below characteristic
	{
		log("V1");
		outputChar += ' {{roll=<span style="font-family: \'dicefontd10\'">T</span><span style="font-weight:bold; font-size:1.2em;">'+dice+'</span>}} {{diff=<span style="font-weight:bold; font-size:1.2em;">' +total+ '</span><span style="font-size:0.8em;"> (<span style="font-family: \'Pictos\'">U</span>' +charVal+ ' + <span style="font-family: \'Pictos\'">+</span>' +mod+ ')</span>}}';
		
		total -= dice; // total - dice give the result range
		
		// check if roll a critical success or a fumble
		if (dice == 1) // roll a 1 it's a critical success : add 3 to result range
		{
			log("Critical Success!");
			total += 3;
			outputChar += ' {{critical=+3}}';
		} else if (dice == 10) // roll a 10 it's a fumble : remove 3 to result range
		{
			log("Fumble!");
			total += -3;
			outputChar += ' {{fumble=-3}}';
		}

		//  a negative number is a fail, a positive number a success
		if (total < 0)
			outputChar += " {{fail="+total+"}}";
		else
			outputChar += " {{sucess="+total+"}}";
		
	}
	else // V2 system : a dice + characteristic
	{
		log("V2");
		
		total += dice; // add dice to characteristic
		
		// check if roll a critical success or a fumble
		// the values are reverse related to V1 system
		if (dice == 1) // Fumble ! Remove 2 to result
		{
			log("Fumble!");
			total += -2;
			outputChar += ' {{fumble=-2}}';
		} else if (dice == 10) // Critical ! Add 2 to result
		{
			log("Critical Success!");
			total += 2;
			outputChar += ' {{critical=+2}}';
		}
		
		outputChar += ' {{roll=<span style="font-weight:bold; font-size:1.2em;">'+total+'</span> <span style="font-size:0.8em;">(<span style="font-family: \'dicefontd10\'">T</span>'+dice+' + <span style="font-family: \'Pictos\'">U</span>'+charVal+' + <span style="font-family: \'Pictos\'">+</span>'+mod+')</span>}}';
	}
	
	return outputChar;
}

/** Roll a 1d100 with the Anima's system :
 * 
 * open roll if dice > 90 the first time, then 91 ... until 100
 * capped the dice if exceed the inhumanity or zen ability.
 * roll a fumble if dice is < 3 (5 if it's complex, but decrease by 1 with the mastery)
 * ...

 * 
 * @param fumbleCeil 	: Number, 3 by default, to modify if complex or mastery.
 * @param openFloor 	: array ([90, [<extraVal1>,<extraVal2>,...]]), the first value is the "classic" floor (90),
 *  				  	  the second value is an array containing the extra values causing a open roll like double values (11, 22, 33...)
 * @param mod 			: Number, the modifier on dice
 * @param close 		: Boolean, prevent open roll and fumble if true
 * @param initiative	: Boolean, use initiative modifier in case of fumble. Close dice
 * @param inhumanity 	: Boolean, capped dice to 319 if false, 439 if true
 * @param zen 			: Boolean, not capped dice if true
 * 
 * @returns
 * 	[
 *   	"output": String, The output to sendChat,
 *   	"res": Number, the dice result,
 *   	"fumble": True if fumble has obtained,
 *   	"fumbleLevel": Number, the fumble level where appropriate
 *  ]
 */
function openRoll(fumbleCeil, openFloor, val, mod, close, initiative, inhumanity, zen)
{
	var outputRoll = "";
	var open;				// Flag for the player having rolled a number above openFloor.
	var dice;				// Numberical value of latest dice rolled (1d100). Good for debugging/transparency.
	var rollCount=1;		// Number of times dice have been rolled. Good for debugging and fumble validation.
	var rollTracking=''; 	// Track rolls in string form for logs / output.
	var capped = false;     // Flag to display to the player when their roll is limited.
	var fumble = false;
	var fumbleLevel = false;
	var total = mod + val;
	
	log('Openroll Floor: '+openFloor);
    log('Fumble Ceiling: '+fumbleCeil);
	
	do
	{
        open=false; 					
        
    	dice = randomInteger(100); 		// Roll 1d100.            
        log('Dice roll ' +rollCount + ': '+dice);
		
        
        if(dice <= fumbleCeil && rollCount==1)
        {
			// if dice result was < fumbleCeil, a fumble has occured.
			// NOTE: fumbles cannot happen after an open roll occurs, hence the check on rollCount.
        	fumble = true;
			fumbleMod = 0;
			fumbleDice = 0;

			if (initiative)
			{
				fumbleModArray = [-125, -100, -75];
				
				fumbleLevel = fumbleModArray[dice-1];
				
			} else if (close)
				fumbleLevel=dice;
			else
			{
				fumbleModArray = [-15, 0, 15, 15, 15];
				fumbleModArrayMastery = [0, 15];
				
				if (fumbleCeil == 2)
					fumbleMod = fumbleModArrayMastery[dice-1];
				else
					fumbleMod = fumbleModArray[dice-1];
				
				fumbleDice=randomInteger(100);
				fumbleLevel= fumbleMod - fumbleDice;
				log('Fumble Level: '+fumbleLevel);
				outputRoll += ' {{fumble='+fumbleLevel+'}}';

				if (fumbleLevel <= -80)
					outputRoll += ' {{fumbleCritical=1}}';
				
			}

			total += fumbleLevel;
			rollTracking += '('+fumbleLevel+')+';

        } else
    	{
            //check if dice result was > openFloor, if so, will roll again.
            if( !close && (dice >= openFloor[0] || openFloor[1].includes(dice)))
            {

            	if(openFloor[0] <100)
            		openFloor[0]++; 						// Increment openFloor, can never exceed 100.
            	
                rollTracking += '<a style="color:Green"><b>'+dice+'</b></a>+';	// Add dice roll to string for output later.
                open=true;
				rollCount++;

            } else
                rollTracking += dice+'+';
        
            total += dice;	//record the total so far.
    	}
	} while(open); 		//roll again if openroll occured.
		

    //take off the last + in the rollTracking string so the output doesn't look stupid.
	rollTracking = rollTracking.substring(0,(rollTracking.length)-1);
	
	
    //apply any and all limitations.
    if(inhumanity && !zen)//only one can apply, as zen overwrites inhumanity.
    {
        if(total>439)
        {
            capped = true;  // the player was limited.
            dice = total;   //reuse variable, save original (uncapped) roll.
            total = 439; 	//zen starts at 440.
        }
    } else if(!zen)
    {
        if(total > 319)
        {
            capped = true;  // the player was limited.
            dice = total;   // reuse variable, save original (uncapped) roll.
            total = 319;	// standard roll, limit below inhumanity (320).
        }
    } //no else case for if(zen), as all rolls above 440 are allowed if the roll has zen.
	
    if(capped)
    	outputRoll += ' {{capped='+dice+'}}';
    

    outputRoll += ' {{roll=<span style="font-weight:bold; font-size:1.2em;">'+total+'</span><span style="font-size:0.8em;"> (<span style="font-family: \'dicefontd10\'">T</span>'+rollTracking+' + <span style="font-family: \'Pictos\'">U</span>'+val+' + <span style="font-family: \'Pictos\'">+</span>' +mod+')</span>}}';
	
	return {'output' : outputRoll, 'res' : total, 'fumble' : fumble, 'fumbleLevel' : fumbleLevel};
}

/** calculate the result of an attack
 * 
 * @param diceResult	: array, the output of openRoll function
 * @param baseDmg 		: Number, the base of weapon's damage
 * @param def 			: Number, the defense result
 * @param armor 		: Number, the value of armor degree
 * 
 * @returns String, the output to sendChat
 */
function attackRes(diceResult, baseDmg, def, armor, criticalHitOptions)
{
	var outputAttack = " {{diff=" + def + " Armor " + armor + "}}";
	
    var att = diceResult["res"]; // get the res of attack
	var range = att - def; // calculate the range of attack
	// range of attack can be cut in level : between 0 and 9 it's the same result, idem between 10 and 19, etc until 400. And too for negatives values.
	// each level have a step of 10 -> calculate a index of each level.
    var rangeIndex = parseInt(range / 10);
    
	// for the range result between 0 and 100, the result is not linear
    // the follow array contains the % of damage by level (0 to 10) and by armor degree
	var dmgArray = [
	    [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	    [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	    [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	    [ 10,10,10, 0, 0, 0, 0, 0, 0, 0, 0],
	    [ 30,20,20,10, 0, 0, 0, 0, 0, 0, 0],
	    [ 50,40,30,20,10, 0, 0, 0, 0, 0, 0],
	    [ 60,50,40,30,20,10, 0, 0, 0, 0, 0],
	    [ 70,60,50,40,30,20,10, 0, 0, 0, 0],
	    [ 80,70,60,50,40,30,20,10, 0, 0, 0],
	    [ 90,80,70,60,50,40,30,20,10, 0, 0],
	    [100,90,80,70,60,50,40,30,20,10, 0]
    ];
    
    
    var res = 0;
    if (range < 0)
    {
        // Fail
        if (range <= -300) 
            res = 150;
        else    
            res = rangeIndex * -5; // the bonus to counter attack increase by 5 foreach level : +0 for level 0 (range between -1 and -9), +5 for next level...
        
        outputAttack += ' {{fail=+' + res + 'C (range : ' + range + ')}}';
        
    } else
    {
        // Success
        if (range >= 400)
            res = 400 - armor*10; // maximum damage - armor (10% / armor degree)
        
        else
        {
            if (rangeIndex <= 10) // below this level, the progression isn't linear -> use the array
                res = dmgArray[rangeIndex][armor];
            
            else // level*10 = the % of range
                res = rangeIndex*10 - armor*10;
        }
        
        // the damage is the range % of baseDmg
        var dmg = baseDmg / 100 * res;
        
        outputAttack += ' {{sucess=Damage : ' + dmg + ' (range : ' + range + ')}} {{criticalhit=[Critical Hit ?](!openroll criticalhit,'+dmg+',&#63;{Locate|true|false},&#63;{Resistance|0} &#63;{Modifier|0} '+criticalHitOptions+')}}';
    }
    
    return outputAttack;
}

/** Function to calculate critical hit result
 * 
 * @param resistance	: Number, value of physical resistance
 * @param dmg 			: Number, the damage inflicted
 * @param mod 			: Number, the modifier to critical level
 * @param locate 		: Boolean, true if hit wasn't locate (launch 1d100 to locate if critical range > -50)
 * 
 * @returns String, the output to sendChat
 */
function criticalHit(resistance, dmg, mod, locate)
{
	var outputCriticalHit = "";
	var locationStr = "";
	
	var locationTable = 
		[
			[ 1, 10, "cote"],
			[11, 20, "epaule"],
			[21, 30, "estomac"],
			[31, 35, "reins"],
			[36, 48, "torse"],
			[49, 50, "coeur"],
			[51, 54, "bras droit"],
			[55, 58, "avant-bras droit"],
			[59, 60, "main droite"],
			[61, 64, "bras gauche"],
			[65, 68, "avant-bras gauche"],
			[69, 70, "main gauche"],
			[71, 74, "cuisse droite"],
			[75, 78, "tibia droit"],
			[79, 80, "pied droit"],
			[81, 85, "cuisse gauche"],
			[86, 88, "tibia gauche"],
			[89, 90, "pied gauche"],
			[91, 100, "tete"]
		]
	
	dice=randomInteger(100);
	criticalLevel = dice + dmg + mod;
	
	// excess points 200 are /2.
	if (criticalLevel > 200)
		criticalLevel -= (criticalLevel-200)/2;
	
	
	criticalRange = resistance - criticalLevel;
	
	if (criticalRange >= 0) // Sucess
	
		outputCriticalHit += "{{resists=true}}";
	
	else // fail
	{
		// 0 > range > -50
		outputCriticalHit += "{{criticalhit=Malus : " + criticalRange + "}}";
		
		if (criticalRange < -50) // -50 > range > -100 
		{
			// locate the hit, if it wasn't yet
			if (locate)
			{
				location = randomInteger(100);
				
				for (i=0; i<locationTable.length; i++)
				{
					if (location >= locationTable[i][0] && location <= locationTable[i][1])
						locationStr = locationTable[i][2]
				}
			}
			
			outputCriticalHit += " {{range-50=true}} {{location=" + locationStr + "}}";
		}
		
		if (criticalRange < -100) // -100 > range > -150 
		
			outputCriticalHit += " {{range-100=true}}";
		
		if (criticalRange < -150) // -150 > range
		
			outputCriticalHit += " {{range-150=true}}";
	}
	
	return outputCriticalHit;
}

/** Script for manage Anima Beyond Fantasy system
 * 
 * use : !openroll <mod1> <mod2> <mod3> ...
 * By default the script roll 1d100 with the mecanism of Anima's open roll : (90, 91, 92...)
 * Modifiers, separate by blank space can be applied. The possible values is :
 * 
 * who:<string> -> the String used for sendChat function as SpeakingAs parameter. If not set, the script use msg.playerid of the 'chat:message' event
 * 
 * <number> -> a number like 50 or 90. Several number are add between them. For sample : !openroll 50 90 -> roll 1d100+140
 * 
 * inhumanity | inhuman -> the total is capped to 439 (319 else).
 * 
 * zen -> the total isn't capped.
 * 
 * initiative -> Roll a dice with the correct modifiers for initiative (ie : not open roll and [-125, -100, -75] modifiers in case of fumble [1, 2, 3]) 
 * 
 * close -> roll a not open dice and not fumble (ie : resistance dice)
 * 
 * complex -> increase the fumble range to +2
 * 
 * mastery -> decrease the fumble range to -1
 * 
 * expr:<mathExpr> -> allow to realize mathematical expression. For sample : !openroll expr:1*15 -> roll 1d100+1*15. Beware with this modifiers ! eval() function used...
 * 
 * name:<name> -> Display the name in template
 * 
 * val:<number>|expr:<mathExpr> -> the competence/characteristics value (only for display)
 * 
 * characteristics:v<1|2>:<charVal>|expr:<mathExpr> -> roll a V1 or V2 characteristics test.
 * 		Possible usage : !openroll characteristics:v1:7 ; !openroll characteristics:v1:expr:5+2
 * 	param v<1|2>						: v1|v2, the system version. v1 : char's val - 1d10; v2 1d10 + char's val.
 * 	param <charVal>	| expr:<mathExpr>	: Number or String, the characteristics' value. A mathematical expression is possible
 * 
 * attack:<baseDmg>:<defVal>:<armor> -> Calculate the result of an attack.
 * 	param <baseDmg>	: Number, the base of weapon damage
 * 	param <defVal>	: Number, the Defense value of target
 * 	param <armor>	: Number, the armor of target.
 * 
 * gm -> roll in secret
 * 
 * cs:<val> -> add a extra value to openFloor. For example "cs:11 cs:22 cs:33 cs:44 cs:55 cs:66 cs:77 cs:88 cs:99" add the doubles values to openFloor
 * 	param <val>	: Number, the extra value to add to openFloor.
 * 
 * criticalhit,<dmg>,<locate>,<resistance> -> calculate the critical hit result.
 * 	param <dmg> 		: Number, the damage inflicted
 * 	param <locate> 		: Boolean, true if the hit wasn't locate
 * 	param <resistance>	: Number, the resistance of target
 * 
 * @param msg : String, the "!openroll <mod1> <mod2> <mod3> ..." command
 * 
 * @returns Nothing, send a msg to chat box
 */
on('chat:message',function(msg)
{
	    
    //parse the message type
    if(msg.type != 'api')
    	return;
    
    var parts = msg.content.toLowerCase().split(' ');
    log( 'parts: '+parts);
    var command = parts.shift().substring(1); //remove the !
    
    if(command == 'openroll')
    {    //Variable Declarations
    	var who = "";
    	var diceRes;
		var openFloor = [90, []]; 	// The minimum result needed to roll again. set to the default described in the core rules.
		var fumbleCeil = 3; 	// Rolls below or equal to this number are considered fumbles. set to core rules default.
		var close = false;		// Flag to set dice to closed.
        var mod = 0;            // Variable to keep track of mod throughout number calculations.
        var inhumanity = false;	// Limit rolls below 320 unless this is true.
        var zen = false;		// Limit rolls below 440 unless this is true.
		var initiative = false; // Flag to set the result after flag calculation to the initiative table.
        var capped = false;     // Flag to display to the player when their roll is limited.
        var expr = "";
        var output = "";
        
        var val = 0;
        
        var testChar = false;
        var testCharV1 = false;
        var testCharV2 = false;
        
        var attack = false;
        var baseDmg = 0;
        var defVal = 0;
        var armor = 0;
        var criticalHitOptions = "";
        
        var cmdMsg = "/direct ";
        
        var criticalhit = false;
        var dmg = 0;
        var locate = true;
        var resistance = 0;
		
		//loop through the remaining parts for flags and other mods
        _.each(parts,function(curPart)
		{
            if(!isNaN(Number(curPart)))
            	//add numbers to mod
                mod+= Number(curPart);
            
            else if (curPart.startsWith('{'))
            	output += " " + curPart;
            else {
            	switch (curPart)
            	{
            		case "gm" :
            			cmdMsg = "/w gm ";
            			criticalHitOptions = "gm ";
            			break;
            		
	            	case "inhumanity" :
	            	case "inhuman" :
	            		inhumanity = true;
	            		break;
            		
	            	case "zen" :
	            		zen = true;
	            		break;
	            		
	            	case "initiative":
	            		initiative = true;
	                    close = true;
	                    break;
	                    
	            	case "close":
	            		close = true;
	            		break;
	            		
	            	case "complex" :
	            		if(!initiative)
	                		// complex doesn't apply to initiative rolls.
	                    	fumbleCeil+=2;
	            		break;
	            		
	            	case "mastery" :
	            		if(!initiative)
	                		//mastery doesn't apply to initiative rolls.
	                    	fumbleCeil--;
	            		break;
	            		
            		default :
            			if (curPart.includes(":"))
                    	{
                        	curPartVal = curPart.split(":");
                        	
                        	switch(curPartVal[0])
                        	{                        			
                        		case "cs":
                        			openFloor[1].push(Number(curPartVal[1]));
                        			break;
                        			
                        		case "who":                        			
                        			if (curPartVal[1] == "player")
                    				{
                        				who = 'player|'+msg.playerid;
                        				criticalHitOptions += "who:player";
                    				}
                        			else
                        			{
                        				name = curPartVal[1];
                        				var characters = findObjs({_type: 'character'});
                        		        var character;
                        		        characters.forEach(function(chr)
                        				{
                        		        	if(chr.get('name').toLowerCase() == name)
                        		        		character = chr;
                        		    	});
                        		        
                        				who = 'character|'+character.id;
                        				criticalHitOptions += "who:"+character.id;
                        			}
                        			
                        			break;
                        		
                    			case "template":
                    				output = "&{template:ABF" + curPartVal[1] + "}";
                    				break;
                    				
                        		case "expr":
                        			mod += evaluateExpr(curPartVal[1]);
                        			break;
                        			
                        		case 'val':
                        			if (curPartVal[1] == "expr")
                            		{
                                		log ("expr");
                                		val = evaluateExpr(curPartVal[2]);
                            		}
                                	else
                            		{
                                		log("number " + curPartVal[1]);
                                		val = Number(curPartVal[1]);
                            		}
                        			
                        			break;
                        			
                        		case "characteristics":
                        			testChar = true;
                                	log ("test char");
                                	
                                	if (curPartVal[1] == "v1")
                            		{
                                		log ("v1");
                                		testCharV1 = true;
                            		}
                            		else
                        			{
                            			log ("v2");
                            			testCharV2 = true;
                        			}
                                	
                                	break;
                                	
                        		case "attack":
                        			attack = true;
        	                    	
                                	baseDmg = evaluateExpr(curPartVal[1]);
                                	defVal = curPartVal[2];
                                	armor = curPartVal[3];
                                	
                                	break;
                        	}
                    	} else if (curPart.includes(","))
                    	{
                        	curPartVal = curPart.split(",");
                        	
                        	switch(curPartVal[0])
                        	{
                        		case "criticalhit":
                        			criticalhit = true;
                        			output = "&{template:ABFcriticalhit}";
                        			
                                	dmg = Number(curPartVal[1]);
                                	locate = (curPartVal[2] == 'true');;
                                	resistance = Number(curPartVal[3]);
                                	
                        			break;
                        	}
                    	}
            	}
            }
        });
        
        /*
        if (who == "")
        	who = 'player|'+msg.playerid;
        else
        	criticalHitOptions += "who:"+who.split('|')[0];
        */
        if (testChar)
        	output += testCharacteristic(val, testCharV1, mod);
        
        else if (criticalhit)
        	output += criticalHit(resistance, dmg, mod, locate);
        	
    	else
		{
    		diceRes = openRoll(fumbleCeil, openFloor, val, mod, close, initiative, inhumanity, zen);
    		output += diceRes["output"];
		
	        if (attack)
	        	output += attackRes(diceRes, baseDmg, defVal, armor, criticalHitOptions);
		}
        

   
        log("output is : " + output);
        sendChat(who, cmdMsg + output);
        
        if (who.includes("player"))
        {
        	player = getObj('player', msg.playerid);
        	playerName = player.get('displayname');
        	sendChat(who, "/w " + playerName + " " + output);
        }
    }
});
