/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { Selection } from 'vs/editor/common/core/selection';
import { SnippetController2 } from 'vs/editor/contrib/snippet/browser/snippetController2';
import { ICommonCodeEditor } from 'vs/editor/common/editorCommon';
import { mockCodeEditor } from 'vs/editor/test/common/mocks/mockCodeEditor';
import { Model } from 'vs/editor/common/model/model';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';

suite('SnippetController2', function () {

	function assertSelections(editor: ICommonCodeEditor, ...s: Selection[]) {
		for (const selection of editor.getSelections()) {
			const actual = s.shift();
			assert.ok(selection.equalsSelection(actual), `actual=${selection.toString()} <> expected=${actual.toString()}`);
		}
		assert.equal(s.length, 0);
	}

	function assertContextKeys(service: MockContextKeyService, inSnippet: boolean, hasPrev: boolean, hasNext: boolean): void {
		assert.equal(SnippetController2.InSnippetMode.getValue(service), inSnippet, `inSnippetMode`);
		assert.equal(SnippetController2.HasPrevTabstop.getValue(service), hasPrev, `HasPrevTabstop`);
		assert.equal(SnippetController2.HasNextTabstop.getValue(service), hasNext, `HasNextTabstop`);
	}

	let editor: ICommonCodeEditor;
	let model: Model;
	let contextKeys: MockContextKeyService;

	setup(function () {
		contextKeys = new MockContextKeyService();
		model = Model.createFromString('if\n    $state\nfi');
		editor = mockCodeEditor([], { model });
		editor.setSelections([new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5)]);
		assert.equal(model.getEOL(), '\n');
	});

	teardown(function () {
		model.dispose();
	});

	test('creation', function () {
		const ctrl = new SnippetController2(editor, contextKeys);
		assertContextKeys(contextKeys, false, false, false);
		ctrl.dispose();
	});

	test('insert, insert -> abort', function () {
		const ctrl = new SnippetController2(editor, contextKeys);

		ctrl.insert('foo${1:bar}foo$0');
		assertContextKeys(contextKeys, true, false, true);
		assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));

		ctrl.cancel();
		assertContextKeys(contextKeys, false, false, false);
		assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));
	});

	test('insert, insert -> tab, tab, done', function () {
		const ctrl = new SnippetController2(editor, contextKeys);

		ctrl.insert('${1:one}${2:two}$0');
		assertContextKeys(contextKeys, true, false, true);

		ctrl.next();
		assertContextKeys(contextKeys, true, true, true);

		ctrl.next();
		assertContextKeys(contextKeys, false, false, false);

		editor.trigger('test', 'type', { text: '\t' });
		assert.equal(SnippetController2.InSnippetMode.getValue(contextKeys), false);
		assert.equal(SnippetController2.HasNextTabstop.getValue(contextKeys), false);
		assert.equal(SnippetController2.HasPrevTabstop.getValue(contextKeys), false);
	});

	test('insert, insert -> cursor moves out (left/right)', function () {
		const ctrl = new SnippetController2(editor, contextKeys);

		ctrl.insert('foo${1:bar}foo$0');
		assertContextKeys(contextKeys, true, false, true);
		assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));

		// bad selection change
		editor.setSelections([new Selection(1, 12, 1, 12), new Selection(2, 16, 2, 16)]);
		assertContextKeys(contextKeys, false, false, false);
	});

	test('insert, insert -> cursor moves out (up/down)', function () {
		const ctrl = new SnippetController2(editor, contextKeys);

		ctrl.insert('foo${1:bar}foo$0');
		assertContextKeys(contextKeys, true, false, true);
		assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));

		// bad selection change
		editor.setSelections([new Selection(2, 4, 2, 7), new Selection(3, 8, 3, 11)]);
		assertContextKeys(contextKeys, false, false, false);
	});

	test('insert, insert -> cursors collapse', function () {
		const ctrl = new SnippetController2(editor, contextKeys);

		ctrl.insert('foo${1:bar}foo$0');
		assert.equal(SnippetController2.InSnippetMode.getValue(contextKeys), true);
		assertSelections(editor, new Selection(1, 4, 1, 7), new Selection(2, 8, 2, 11));

		// bad selection change
		editor.setSelections([new Selection(1, 4, 1, 7)]);
		assertContextKeys(contextKeys, false, false, false);
	});

	test('insert, insert plain text -> no snippet mode', function () {
		const ctrl = new SnippetController2(editor, contextKeys);

		ctrl.insert('foobar');
		assertContextKeys(contextKeys, false, false, false);
		assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
	});

	test('insert, delete snippet text', function () {
		const ctrl = new SnippetController2(editor, contextKeys);

		ctrl.insert('${1:foobar}$0');
		assertContextKeys(contextKeys, true, false, true);
		assertSelections(editor, new Selection(1, 1, 1, 7), new Selection(2, 5, 2, 11));

		editor.trigger('test', 'cut', {});
		assertContextKeys(contextKeys, true, false, true);
		assertSelections(editor, new Selection(1, 1, 1, 1), new Selection(2, 5, 2, 5));

		editor.trigger('test', 'type', { text: 'abc' });
		assertContextKeys(contextKeys, true, false, true);

		ctrl.next();
		assertContextKeys(contextKeys, false, false, false);

		editor.trigger('test', 'tab', {});
		assertContextKeys(contextKeys, false, false, false);

		// editor.trigger('test', 'type', { text: 'abc' });
		// assertContextKeys(contextKeys, false, false, false);
	});

	test('insert, nested snippet', function () {
		const ctrl = new SnippetController2(editor, contextKeys);
		ctrl.insert('${1:foobar}$0');
		assertContextKeys(contextKeys, true, false, true);
		assertSelections(editor, new Selection(1, 1, 1, 7), new Selection(2, 5, 2, 11));

		ctrl.insert('far$1boo$0');
		assertSelections(editor, new Selection(1, 4, 1, 4), new Selection(2, 8, 2, 8));
		assertContextKeys(contextKeys, true, false, true);

		ctrl.next();
		assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
		assertContextKeys(contextKeys, true, true, true);

		ctrl.next();
		assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
		assertContextKeys(contextKeys, false, false, false);
	});

	test('insert, nested plain text', function () {
		const ctrl = new SnippetController2(editor, contextKeys);
		ctrl.insert('${1:foobar}$0');
		assertContextKeys(contextKeys, true, false, true);
		assertSelections(editor, new Selection(1, 1, 1, 7), new Selection(2, 5, 2, 11));

		ctrl.insert('farboo');
		assertSelections(editor, new Selection(1, 7, 1, 7), new Selection(2, 11, 2, 11));
		assertContextKeys(contextKeys, false, false, false);
	});

	test('Inconsistent tab stop behaviour with recursive snippets and tab / shift tab, #27543', function () {
		const ctrl = new SnippetController2(editor, contextKeys);
		ctrl.insert('1_calize(${1:nl}, \'${2:value}\')$0');

		assertContextKeys(contextKeys, true, false, true);
		assertSelections(editor, new Selection(1, 10, 1, 12), new Selection(2, 14, 2, 16));

		ctrl.insert('2_calize(${1:nl}, \'${2:value}\')$0');

		assertSelections(editor, new Selection(1, 19, 1, 21), new Selection(2, 23, 2, 25));

		ctrl.next(); // inner `value`
		assertSelections(editor, new Selection(1, 24, 1, 29), new Selection(2, 28, 2, 33));

		ctrl.next(); // inner `$0`
		assertSelections(editor, new Selection(1, 31, 1, 31), new Selection(2, 35, 2, 35));

		ctrl.next(); // outer `value`
		assertSelections(editor, new Selection(1, 34, 1, 39), new Selection(2, 38, 2, 43));

		ctrl.prev(); // inner `$0`
		assertSelections(editor, new Selection(1, 31, 1, 31), new Selection(2, 35, 2, 35));
	});
});
