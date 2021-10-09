/* Adapted from QuickAdd
 * https://github.com/chhoumann/quickadd/blob/master/src/utility.ts
 */

import { App, TAbstractFile, TFile } from 'obsidian';

export interface Script {
	path: string;
	member: string;
}

export function getScriptMemberAccess(fullMemberPath: string): { basename: string | undefined, memberAccess: string[] | undefined } {
    const fullMemberArray: string[] = fullMemberPath.split("::");
    return {
        basename: fullMemberArray[0],
        memberAccess: fullMemberArray.slice(1)
    }
}

export async function getScript(script: Script, app: App) {
	console.log("in get script");
	app.vault.adapter.write('log.md', 'in get script');
	// @ts-ignore
	const vaultPath = app.vault.adapter.getBasePath();
	const file: TAbstractFile = app.vault.getAbstractFileByPath(script.path);
	console.log(vaultPath);
	console.log(file.path);
	if (!file) {
		console.log("nofile");
		console.error(`failed to load file ${script.path}.`);
		return;
	}

	if (file instanceof TFile) {
		const filePath = `${vaultPath}/${file.path}`;

		if (window.require.cache[window.require.resolve(filePath)]) {
			delete window.require.cache[window.require.resolve(filePath)];
		}

		// @ts-ignore
		const scriptFile = await import(filePath);
		if (!scriptFile || !scriptFile.default) {
			console.log("no script file");
			return;
		}

		let scriptData = scriptFile.default;

		const { memberAccess } = getScriptMemberAccess(script.member);
		if (memberAccess && memberAccess.length > 0) {
			let member: string;
			while (member = memberAccess.shift()) {
				scriptData = scriptData[member];
			}
		}

		return scriptData;
	}
}
