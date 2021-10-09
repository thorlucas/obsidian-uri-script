import { normalizePath, App, Modal, Plugin, PluginSettingTab, Setting, ButtonComponent, ExtraButtonComponent, ObsidianProtocolData, TextComponent } from 'obsidian';
import { Script, getScript } from './script';

type UriEndpoint = string;

interface UriSettings {
	name: string;
	endpoint: UriEndpoint;
	script: Script;
}

interface UriScriptPluginSettings {
	endpoints: {
		[endpoint: UriEndpoint]: UriSettings
	}
}

const DEFAULT_SETTINGS: UriScriptPluginSettings = {
	endpoints: {
		'my-script': {
			name: 'My Script',
			endpoint: 'my-script',
			script: {
				path: 'test.js',
				member: 'test::handler',
			},
		}
	}
}

function monkeyPatchConsole(plugin: Plugin) {
	// @ts-ignore
	if (!plugin.app.isMobile) {
		return;
	}

	const logFile = `${plugin.manifest.dir}/logs.txt`;
	const logs: string[] = [];
	const logMessages = (prefix: string) => (...messages: unknown[]) => {
		logs.push(`\n[${prefix}]`);
		for (const message of messages) {
			logs.push(String(message));
		}
		plugin.app.vault.adapter.write(logFile, logs.join(" "));
	};

	console.debug = logMessages("debug");
	console.error = logMessages("error");
	console.info = logMessages("info");
	console.log = logMessages("log");
	console.warn = logMessages("warn");
}

export default class UriScriptPlugin extends Plugin {
	settings: UriScriptPluginSettings;

	async onload() {
		//monkeyPatchConsole(this);
		console.log('loading plugin');

		//await this.loadSettings();
		//await this.registerHandlers();

		//this.addSettingTab(new UriScriptSettingTab(this.app, this));

		//this.addCommand({
			//id: 'uri-script-test',
			//name: 'Test',
			//callback: () => {
				//this.protocolHandler({
					//action: 'dose',
					//foo: 'bar',
				//});
			//}
		//});
	}

	onunload() {
		console.log('unloading plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		await this.registerHandlers();
	}

	async registerHandlers() {
		Object.values(this.settings.endpoints).forEach(async (uriSettings: UriSettings) => {
			console.log('Registering endpoint: ', uriSettings);
			this.registerObsidianProtocolHandler(uriSettings.endpoint, this.protocolHandler.bind(this));
		});
	}

	async protocolHandler(params: ObsidianProtocolData) {
		console.log("calling protcol handler");
		console.log(JSON.stringify(params));
		const endpoint: UriSettings = this.settings.endpoints[params.action];
		console.log("going to get script now...");
		console.log(JSON.stringify(this.settings));
		console.log(JSON.stringify(endpoint));

		getScript(endpoint.script, this.app)
		.then((handler) => {
			console.log("got handler");
			console.log(handler);
			handler(params);
		})
		.catch((err) => {
			console.error(err);
		});

		console.log("wtf");
	}
}

class UriScriptSettingTab extends PluginSettingTab {
	plugin: UriScriptPlugin;

	constructor(app: App, plugin: UriScriptPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		let { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', {
			text: 'URI Script Settings',
		});

		Object.values(this.plugin.settings.endpoints).forEach((uriSettings: UriSettings) => {
			new Setting(containerEl)
				.setName(uriSettings.name)
				.setDesc('obsidian://' + uriSettings.endpoint)
				.addExtraButton((button: ExtraButtonComponent): ExtraButtonComponent => {
					return button
						.setIcon('trash')
						.setTooltip('Delete')
						.onClick(async () => {
							delete this.plugin.settings.endpoints[uriSettings.endpoint];
							await this.plugin.saveSettings();
							this.display();
						});
				})
				.addButton((button: ButtonComponent): ButtonComponent => {
					return button
						.setIcon('pencil')
						.setTooltip('Edit')
						.onClick(async () => {
							let modal = new UriScriptSettingModal(this.app, uriSettings);

							modal.onClose = async () => {
								if (modal.saved) {
									// FIXME: Move this logic to within the plugin class
									console.log(uriSettings);
									delete this.plugin.settings.endpoints[uriSettings.endpoint];
									this.plugin.settings.endpoints[modal.endpoint] = {
										name: modal.name,
										endpoint: modal.endpoint,
										script: {
											path: modal.path,
											member: modal.member,
										},
									};
									await this.plugin.saveSettings();
									this.display();
								}
							};

							modal.open();
						});
				});
		});

		new Setting(containerEl)
			.setName('Add New')
			.setDesc('Add a new URI endpoint.')
			.addButton((button: ButtonComponent): ButtonComponent => {
				return button
					.setButtonText('+')
					.setTooltip('Add URI Endpoint')
					.onClick(async () => {
						// FIXME: DRY
						let modal = new UriScriptSettingModal(this.app);

						modal.onClose = async () => {
							if (modal.saved) {
								// FIXME: Move this logic to within the plugin class
								this.plugin.settings.endpoints[modal.endpoint] = {
									name: modal.name,
									endpoint: modal.endpoint,
									script: {
										path: modal.path,
										member: modal.member,
									}
								};
								await this.plugin.saveSettings();
								this.display();
							}
						};

						modal.open();
					});
			});
	}
}

class UriScriptSettingModal extends Modal {
	name: string;
	endpoint: UriEndpoint;
	path: string;
	member: string;
	saved: boolean = false;

	constructor(app: App, settings?: UriSettings) {
		super(app);
		if (settings) {
			this.name = settings.name;
			this.endpoint = settings.endpoint;
			this.path = settings.script.path;
			this.member = settings.script.member;
		}
	}

	onOpen() {
		this.display();
	}

	async display() {
		let { contentEl } = this;

		contentEl.empty();

		new Setting(contentEl)
			.setName('Name')
			.setDesc('The purely aesthetic name for the endpoint.')
			.addText((text: TextComponent): TextComponent => {
				return text
					.setPlaceholder('My Script')
					.setValue(this.name)
					.onChange(async (value: string) => {
						this.name = value;
					});
			});

		new Setting(contentEl)
			.setName('Endpoint')
			.setDesc('The URI endpoint to call your script.')
			.addText((text: TextComponent): TextComponent => {
				return text
					.setPlaceholder('my-script')
					.setValue(this.endpoint)
					.onChange(async (value: string) => {
						this.endpoint = value;
					});
			});

		new Setting(contentEl)
			.setName('Path')
			.setDesc('The path to the script file.')
			.addText((text: TextComponent): TextComponent => {
				return text
					.setPlaceholder('my-script.js')
					.setValue(this.path)
					.onChange(async (value: string) => {
						this.path = value;
					});
			});

		new Setting(contentEl)
			.setName('Member')
			.setDesc('The member in the script to the handler.')
			.addText((text: TextComponent): TextComponent => {
				return text
					.setPlaceholder('my-script::handler')
					.setValue(this.member)
					.onChange(async (value: string) => {
						this.member = value;
					});
			});

		let footerEl = contentEl.createDiv();

		new Setting(footerEl)
			.addButton((button: ButtonComponent): ButtonComponent => {
				return button
					.setIcon('checkmark')
					.setTooltip('Save')
					.onClick(async () => {
						// TODO: Validate
						this.saved = true;
						this.close();
					});
			})
			.addExtraButton((button: ExtraButtonComponent): ExtraButtonComponent => {
				return button
					.setIcon('cross')
					.setTooltip('Cancel')
					.onClick(() => {
						this.saved = false;
						this.close();
					});
			});
	}
}
