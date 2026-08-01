#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const output = path.resolve(process.argv[3] || path.join(root, 'docs', 'generated', 'PRISMA_ABYSS_ALL_DIALOGUE_AND_EVENT_LOGS_20260731.csv'));

function loadStoryData() {
    const sandbox = { console };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const file of ['story.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
    }
    if (!sandbox.STORY_MANAGER_DATA) throw new Error('STORY_MANAGER_DATA could not be loaded.');
    return sandbox.STORY_MANAGER_DATA;
}

function oneLine(value) {
    return String(value ?? '').replace(/\r\n?/g, '\n').replace(/\n/g, '\\n');
}

function compactValue(value, depth = 0) {
    if (value === null) return 'null';
    if (value === undefined) return '';
    if (typeof value === 'string') return JSON.stringify(oneLine(value));
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
        if (depth > 4) return '[…]';
        return `[${value.map(item => compactValue(item, depth + 1)).join(',')}]`;
    }
    if (typeof value === 'object') {
        if (depth > 4) return '{…}';
        return `{${Object.entries(value).map(([key, item]) => `${key}:${compactValue(item, depth + 1)}`).join(',')}}`;
    }
    return String(value);
}

function summarizeAction(action) {
    if (!action || typeof action !== 'object') return compactValue(action);
    const type = String(action.type || 'ACTION');
    const parts = [];
    for (const [key, value] of Object.entries(action)) {
        if (key === 'type' || ['then', 'else', 'yes', 'no', 'actions', 'winActions', 'options'].includes(key)) continue;
        parts.push(`${key}=${compactValue(value)}`);
    }
    let result = `${type}${parts.length ? `(${parts.join(',')})` : ''}`;
    for (const key of ['then', 'else', 'yes', 'no', 'actions', 'winActions']) {
        if (Array.isArray(action[key])) result += `{${key}:[${action[key].map(summarizeAction).join(' -> ')}]}`;
    }
    if (Array.isArray(action.options)) {
        result += `{options:[${action.options.map((option, index) => {
            const label = option?.text ?? option?.label ?? index;
            const actions = option?.actions || option?.then || [];
            return `${compactValue(label)}=>[${actions.map(summarizeAction).join(' -> ')}]`;
        }).join('; ')}]}`;
    }
    return result;
}

function summarizeEvent(eventId, event) {
    const actions = Array.isArray(event?.actions) ? event.actions.map(summarizeAction).join(' -> ') : '';
    const winActions = Array.isArray(event?.winActions) ? event.winActions.map(summarizeAction).join(' -> ') : '';
    const meta = Object.entries(event || {})
        .filter(([key]) => !['actions', 'winActions'].includes(key))
        .map(([key, value]) => `${key}=${compactValue(value)}`)
        .join(',');
    return `event=${eventId}${meta ? `; meta={${meta}}` : ''}; actions=[${actions}]${winActions ? `; winActions=[${winActions}]` : ''}`;
}

function collectEventReferences(data) {
    const refs = new Map();
    const logs = [];
    const addRef = (scriptId, eventId, pathText, eventSummary) => {
        if (!refs.has(scriptId)) refs.set(scriptId, []);
        refs.get(scriptId).push({ eventId, pathText, eventSummary });
    };
    const walk = (actions, eventId, basePath, eventSummary) => {
        (actions || []).forEach((action, index) => {
            if (!action || typeof action !== 'object') return;
            const actionPath = `${basePath}[${index}]`;
            if (action.type === 'CONV' && typeof action.value === 'string') {
                addRef(action.value, eventId, actionPath, eventSummary);
            }
            if (action.type === 'LOG' && action.value !== undefined) {
                logs.push({
                    id: `LOG:${eventId}:${actionPath}`,
                    name: 'システムログ',
                    text: String(action.value),
                    charId: '',
                    note: `種別=ストーリーイベントLOG; path=${actionPath}; ${eventSummary}`
                });
            }
            for (const key of ['then', 'else', 'yes', 'no', 'actions', 'winActions']) {
                if (Array.isArray(action[key])) walk(action[key], eventId, `${actionPath}.${key}`, eventSummary);
            }
            if (Array.isArray(action.options)) {
                action.options.forEach((option, optionIndex) => {
                    const nested = option?.actions || option?.then || [];
                    walk(nested, eventId, `${actionPath}.options[${optionIndex}]`, eventSummary);
                });
            }
        });
    };
    for (const [eventId, event] of Object.entries(data.events || {})) {
        const summary = summarizeEvent(eventId, event);
        walk(event.actions, eventId, 'actions', summary);
        walk(event.winActions, eventId, 'winActions', summary);
    }
    return { refs, logs };
}

function findTopLevelJsFiles() {
    return fs.readdirSync(root)
        .filter(file => file.endsWith('.js'))
        .map(file => path.join(root, file));
}

function propertyNameText(nameNode) {
    if (!nameNode) return '';
    if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) return nameNode.text;
    return nameNode.getText();
}

function staticExpressionText(node, sourceFile) {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) return node.getText(sourceFile).slice(1, -1);
    return null;
}

function simpleNodeText(node, sourceFile) {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return 'true';
    if (node.kind === ts.SyntaxKind.FalseKeyword) return 'false';
    if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isArrayLiteralExpression(node) && node.elements.length <= 8) return node.getText(sourceFile).replace(/\s+/g, ' ');
    return null;
}

function nearestObjectContext(node, sourceFile) {
    let current = node.parent;
    while (current && !ts.isObjectLiteralExpression(current)) current = current.parent;
    if (!current) return {};
    const wanted = new Set(['id','name','label','type','eventId','area','worldKey','mapId','x','y','floor','requiredFlag','missingFlag','entryKey','toDungeon','toFloor','to','actionLabel','monsterId','progressKey']);
    const context = {};
    for (const prop of current.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = propertyNameText(prop.name);
        if (!wanted.has(key)) continue;
        const value = simpleNodeText(prop.initializer, sourceFile);
        if (value !== null) context[key] = value;
    }
    return context;
}

function nearestCodeContext(node, sourceFile) {
    let current = node.parent;
    while (current) {
        if (ts.isVariableDeclaration(current) && current.name) return `variable=${current.name.getText(sourceFile)}`;
        if (ts.isMethodDeclaration(current) && current.name) return `method=${current.name.getText(sourceFile)}`;
        if (ts.isFunctionDeclaration(current) && current.name) return `function=${current.name.text}`;
        if (ts.isPropertyAssignment(current) && current !== node.parent) return `property=${propertyNameText(current.name)}`;
        current = current.parent;
    }
    return '';
}

function collectSourceLogs() {
    const allowedProperties = new Set(['log', 'inspectLog', 'lockedLog', 'openLog', 'lockedText']);
    const rows = [];
    for (const filename of findTopLevelJsFiles()) {
        const sourceText = fs.readFileSync(filename, 'utf8');
        const rel = path.basename(filename);
        const sf = ts.createSourceFile(rel, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        const visit = node => {
            if (ts.isPropertyAssignment(node)) {
                const prop = propertyNameText(node.name);
                if (allowedProperties.has(prop)) {
                    const text = staticExpressionText(node.initializer, sf);
                    if (text !== null) {
                        const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
                        const line = pos.line + 1;
                        const context = nearestObjectContext(node, sf);
                        const contextText = Object.entries(context).map(([key, value]) => `${key}=${compactValue(value)}`).join(',');
                        const names = { log:'マップログ', inspectLog:'調査ログ', lockedLog:'進行制限ログ', openLog:'開通ログ', lockedText:'進行制限メッセージ' };
                        rows.push({
                            id: `MAPLOG:${rel}:L${line}:${prop}`,
                            name: context.name || context.label || names[prop],
                            text,
                            charId: '',
                            note: `種別=${names[prop]}; source=${rel}:${line}; property=${prop}${contextText ? `; context={${contextText}}` : ''}; ${nearestCodeContext(node, sf)}`
                        });
                    }
                }
            }
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
                && node.expression.expression.getText(sf) === 'App' && node.expression.name.text === 'log') {
                const text = staticExpressionText(node.arguments[0], sf);
                if (text !== null) {
                    const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
                    const line = pos.line + 1;
                    rows.push({
                        id: `APPLOG:${rel}:L${line}`,
                        name: 'システムログ',
                        text,
                        charId: '',
                        note: `種別=直接App.log; source=${rel}:${line}; ${nearestCodeContext(node, sf)}; code=${oneLine(node.getText(sf))}`
                    });
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
    }
    return rows;
}

function csvCell(value) {
    const text = String(value ?? '').replace(/\r\n?/g, '\n');
    return `"${text.replace(/"/g, '""')}"`;
}

function buildRows(data) {
    const { refs, logs } = collectEventReferences(data);
    const rows = [];
    for (const [scriptId, script] of Object.entries(data.scripts || {})) {
        const references = refs.get(scriptId) || [];
        const referenceNote = references.length
            ? references.map(ref => `参照=${ref.eventId}:${ref.pathText}; ${ref.eventSummary}`).join(' || ')
            : '参照イベント=なし（直接呼出・休眠・旧実装定義を含む）';
        const total = Array.isArray(script) ? script.length : 0;
        (script || []).forEach((line, index) => {
            const isDialogue = line && Object.prototype.hasOwnProperty.call(line, 'text');
            const extra = Object.fromEntries(Object.entries(line || {}).filter(([key]) => !['name','text','charId'].includes(key)));
            rows.push({
                id: scriptId,
                name: line?.name || (isDialogue ? '' : '演出'),
                text: isDialogue ? String(line.text ?? '') : '',
                charId: line?.charId ?? '',
                note: `種別=${isDialogue ? '会話' : '会話内演出'}; 行=${index + 1}/${total}${Object.keys(extra).length ? `; 行内コード=${compactValue(extra)}` : ''}; ${referenceNote}`
            });
        });
    }
    rows.push(...logs);
    rows.push(...collectSourceLogs());
    return rows;
}

const data = loadStoryData();
const rows = buildRows(data);
fs.mkdirSync(path.dirname(output), { recursive: true });
const header = ['会話ID','name','text','charId','演出備考'];
const csv = '\ufeff' + [header.map(csvCell).join(','), ...rows.map(row => [row.id,row.name,row.text,row.charId,row.note].map(csvCell).join(','))].join('\r\n') + '\r\n';
fs.writeFileSync(output, csv, 'utf8');

const categoryCounts = rows.reduce((acc, row) => {
    const key = row.id.startsWith('LOG:') ? 'storyLog' : row.id.startsWith('MAPLOG:') ? 'mapLog' : row.id.startsWith('APPLOG:') ? 'appLog' : 'dialogue';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
}, {});
console.log(JSON.stringify({ output, scripts: Object.keys(data.scripts || {}).length, events: Object.keys(data.events || {}).length, rows: rows.length, categoryCounts }, null, 2));
