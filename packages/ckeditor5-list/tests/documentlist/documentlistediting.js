/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import DocumentListEditing from '../../src/documentlist/documentlistediting';

import BoldEditing from '@ckeditor/ckeditor5-basic-styles/src/bold/boldediting';
import UndoEditing from '@ckeditor/ckeditor5-undo/src/undoediting';
import ClipboardPipeline from '@ckeditor/ckeditor5-clipboard/src/clipboardpipeline';
import BlockQuoteEditing from '@ckeditor/ckeditor5-block-quote/src/blockquoteediting';
import HeadingEditing from '@ckeditor/ckeditor5-heading/src/headingediting';
import IndentEditing from '@ckeditor/ckeditor5-indent/src/indentediting';
import TableEditing from '@ckeditor/ckeditor5-table/src/tableediting';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';

import VirtualTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';
import { getData as getModelData, parse as parseModel, setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import { parse as parseView } from '@ckeditor/ckeditor5-engine/src/dev-utils/view';
import stubUid from './_utils/uid';
import prepareTest from './_utils/prepare-test';

describe( 'DocumentListEditing', () => {
	let editor, model, modelDoc, modelRoot, view;

	testUtils.createSinonSandbox();

	beforeEach( async () => {
		editor = await VirtualTestEditor.create( {
			plugins: [ Paragraph, IndentEditing, ClipboardPipeline, BoldEditing, DocumentListEditing, UndoEditing,
				BlockQuoteEditing, TableEditing, HeadingEditing ]
		} );

		model = editor.model;
		modelDoc = model.document;
		modelRoot = modelDoc.getRoot();

		view = editor.editing.view;

		model.schema.extend( 'paragraph', {
			allowAttributes: 'foo'
		} );

		model.schema.register( 'nonListable', {
			allowWhere: '$block',
			allowContentOf: '$block',
			inheritTypesFrom: '$block',
			allowAttributes: 'foo'
		} );

		editor.conversion.elementToElement( { model: 'nonListable', view: 'div' } );

		// Stub `view.scrollToTheSelection` as it will fail on VirtualTestEditor without DOM.
		sinon.stub( view, 'scrollToTheSelection' ).callsFake( () => {} );
		stubUid();
	} );

	afterEach( async () => {
		await editor.destroy();
	} );

	it( 'should have pluginName', () => {
		expect( DocumentListEditing.pluginName ).to.equal( 'DocumentListEditing' );
	} );

	it( 'should be loaded', () => {
		expect( editor.plugins.get( DocumentListEditing ) ).to.be.instanceOf( DocumentListEditing );
	} );

	it( 'should set proper schema rules', () => {
		expect( model.schema.checkAttribute( [ '$root', 'paragraph' ], 'listItemId' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'paragraph' ], 'listIndent' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'paragraph' ], 'listType' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'heading1' ], 'listItemId' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'heading1' ], 'listIndent' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'heading1' ], 'listType' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'blockQuote' ], 'listItemId' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'blockQuote' ], 'listIndent' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'blockQuote' ], 'listType' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'table' ], 'listItemId' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'table' ], 'listIndent' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'table' ], 'listType' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'tableCell' ], 'listItemId' ) ).to.be.false;
		expect( model.schema.checkAttribute( [ '$root', 'tableCell' ], 'listIndent' ) ).to.be.false;
		expect( model.schema.checkAttribute( [ '$root', 'tableCell' ], 'listType' ) ).to.be.false;
	} );

	describe( 'post fixer', () => {
		describe( 'insert', () => {
			function testList( input, inserted, output ) {
				const selection = prepareTest( model, input );

				model.change( () => {
					model.change( writer => {
						writer.insert( parseModel( inserted, model.schema ), selection.getFirstPosition() );
					} );
				} );

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( output );
			}

			it( 'element before nested list', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[]' +
					'<paragraph listIndent="2" listItemId="c" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="2" listItemId="d" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="3" listItemId="e" listType="bulleted">f</paragraph>',

					'<paragraph>x</paragraph>',

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph>x</paragraph>' +
					'<paragraph listIndent="0" listItemId="c" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="0" listItemId="d" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="bulleted">f</paragraph>'
				);
			} );

			it( 'list item before nested list', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[]' +
					'<paragraph listIndent="2" listItemId="c" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="2" listItemId="d" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="3" listItemId="e" listType="bulleted">f</paragraph>',

					'<paragraph listIndent="0" listItemId="x" listType="bulleted">x</paragraph>',

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="0" listItemId="x" listType="bulleted">x</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="d" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="2" listItemId="e" listType="bulleted">f</paragraph>'
				);
			} );

			it( 'multiple list items with too big indent', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[]' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>',

					'<paragraph listIndent="4" listItemId="x1" listType="bulleted">x</paragraph>' +
					'<paragraph listIndent="5" listItemId="x2" listType="bulleted">x</paragraph>' +
					'<paragraph listIndent="4" listItemId="x3" listType="bulleted">x</paragraph>',

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="2" listItemId="x1" listType="bulleted">x</paragraph>' +
					'<paragraph listIndent="3" listItemId="x2" listType="bulleted">x</paragraph>' +
					'<paragraph listIndent="2" listItemId="x3" listType="bulleted">x</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>'
				);
			} );

			it( 'item with different type - top level list', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="0" listItemId="b" listType="bulleted">b</paragraph>' +
					'[]' +
					'<paragraph listIndent="0" listItemId="c" listType="bulleted">c</paragraph>',

					'<paragraph listIndent="0" listItemId="x" listType="numbered">x</paragraph>',

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="0" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="0" listItemId="x" listType="numbered">x</paragraph>' +
					'<paragraph listIndent="0" listItemId="c" listType="bulleted">c</paragraph>'
				);
			} );

			it( 'multiple items with different type - nested list', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[]' +
					'<paragraph listIndent="2" listItemId="c" listType="bulleted">c</paragraph>',

					'<paragraph listIndent="1" listItemId="x1" listType="numbered">x</paragraph>' +
					'<paragraph listIndent="2" listItemId="x2" listType="numbered">x</paragraph>',

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="1" listItemId="x1" listType="bulleted">x</paragraph>' +
					'<paragraph listIndent="2" listItemId="x2" listType="numbered">x</paragraph>' +
					'<paragraph listIndent="2" listItemId="c" listType="numbered">c</paragraph>'
				);
			} );

			it( 'item with different type, in nested list, after nested list', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="2" listItemId="c" listType="bulleted">c</paragraph>' +
					'[]',

					'<paragraph listIndent="1" listItemId="x" listType="numbered">x</paragraph>',

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="2" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="1" listItemId="x" listType="bulleted">x</paragraph>'
				);
			} );

			it( 'two list items with mismatched types inserted in one batch', () => {
				const input =
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>';

				const output =
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="1" listItemId="d" listType="bulleted">d</paragraph>';

				setModelData( model, input );

				const item1 = '<paragraph listIndent="1" listItemId="c" listType="numbered">c</paragraph>';
				const item2 = '<paragraph listIndent="1" listItemId="d" listType="bulleted">d</paragraph>';

				model.change( writer => {
					writer.append( parseModel( item1, model.schema ), modelRoot );
					writer.append( parseModel( item2, model.schema ), modelRoot );
				} );

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( output );
			} );
		} );

		describe( 'remove', () => {
			function testList( input, output ) {
				const selection = prepareTest( model, input );

				model.change( writer => {
					writer.remove( selection.getFirstRange() );
				} );

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( output );
			}

			it( 'first list item', () => {
				testList(
					'[<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>]' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="2" listItemId="c" listType="bulleted">c</paragraph>',

					'<paragraph listIndent="0" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>'
				);
			} );

			it( 'first list item of nested list', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'[<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>]' +
					'<paragraph listIndent="2" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="3" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="2" listItemId="f" listType="bulleted">f</paragraph>',

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="2" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="2" listItemId="f" listType="bulleted">f</paragraph>'
				);
			} );

			it( 'selection over two different nested lists of same indent', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="0" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="numbered">e</paragraph>]' +
					'<paragraph listIndent="1" listItemId="f" listType="numbered">f</paragraph>',

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="1" listItemId="f" listType="bulleted">f</paragraph>'
				);
			} );
		} );

		describe( 'move', () => {
			function testList( input, offset, output ) {
				const selection = prepareTest( model, input );

				model.change( writer => {
					const targetPosition = writer.createPositionAt( modelRoot, offset );

					writer.move( selection.getFirstRange(), targetPosition );
				} );

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( output );
			}

			it( 'nested list item out of list structure', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'[<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="2" listItemId="c" listType="bulleted">c</paragraph>]' +
					'<paragraph listIndent="3" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="4" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph>x</paragraph>',

					6,

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="2" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph>x</paragraph>' +
					'<paragraph listIndent="0" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>'
				);
			} );

			it( 'list items between lists', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[<paragraph listIndent="2" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="3" listItemId="d" listType="bulleted">d</paragraph>]' +
					'<paragraph listIndent="4" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph>x</paragraph>' +
					'<paragraph listIndent="0" listItemId="f" listType="bulleted">f</paragraph>' +
					'<paragraph listIndent="0" listItemId="g" listType="bulleted">g</paragraph>',

					7,

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="2" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph>x</paragraph>' +
					'<paragraph listIndent="0" listItemId="f" listType="bulleted">f</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="2" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="0" listItemId="g" listType="bulleted">g</paragraph>'
				);
			} );

			it( 'element in between nested list items', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="2" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="3" listItemId="d" listType="bulleted">d</paragraph>' +
					'[<paragraph>x</paragraph>]',

					2,

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph>x</paragraph>' +
					'<paragraph listIndent="0" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="1" listItemId="d" listType="bulleted">d</paragraph>'
				);
			} );

			it( 'multiple nested list items of different types #1 - fix at start', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="0" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="numbered">e</paragraph>]' +
					'<paragraph listIndent="1" listItemId="f" listType="numbered">f</paragraph>' +
					'<paragraph listIndent="0" listItemId="g" listType="bulleted">g</paragraph>' +
					'<paragraph listIndent="1" listItemId="h" listType="numbered">h</paragraph>' +
					'<paragraph listIndent="1" listItemId="i" listType="numbered">i</paragraph>',

					8,

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="1" listItemId="f" listType="bulleted">f</paragraph>' +
					'<paragraph listIndent="0" listItemId="g" listType="bulleted">g</paragraph>' +
					'<paragraph listIndent="1" listItemId="h" listType="numbered">h</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="numbered">c</paragraph>' +
					'<paragraph listIndent="0" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="numbered">e</paragraph>' +
					'<paragraph listIndent="1" listItemId="i" listType="numbered">i</paragraph>'
				);
			} );

			it( 'multiple nested list items of different types #2 - fix at end', () => {
				testList(
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="0" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="numbered">e</paragraph>]' +
					'<paragraph listIndent="1" listItemId="f" listType="numbered">f</paragraph>' +
					'<paragraph listIndent="0" listItemId="g" listType="bulleted">g</paragraph>' +
					'<paragraph listIndent="1" listItemId="h" listType="bulleted">h</paragraph>' +
					'<paragraph listIndent="1" listItemId="i" listType="bulleted">i</paragraph>',

					8,

					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="1" listItemId="f" listType="bulleted">f</paragraph>' +
					'<paragraph listIndent="0" listItemId="g" listType="bulleted">g</paragraph>' +
					'<paragraph listIndent="1" listItemId="h" listType="bulleted">h</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="0" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="numbered">e</paragraph>' +
					'<paragraph listIndent="1" listItemId="i" listType="numbered">i</paragraph>'
				);
			} );

			// #78.
			it( 'move out of container', () => {
				testList(
					'<blockQuote>' +
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="1" listItemId="d" listType="bulleted">d</paragraph>' +
					'[<paragraph listIndent="2" listItemId="e" listType="bulleted">e</paragraph>]' +
					'</blockQuote>',

					0,

					'<paragraph listIndent="0" listItemId="e" listType="bulleted">e</paragraph>' +
					'<blockQuote>' +
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="1" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="1" listItemId="d" listType="bulleted">d</paragraph>' +
					'</blockQuote>'
				);
			} );
		} );

		describe( 'rename', () => {
			it( 'to element that does not allow list attributes', () => {
				const modelBefore =
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[<paragraph listIndent="2" listItemId="c" listType="bulleted" foo="123">c</paragraph>]' +
					'<paragraph listIndent="2" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="3" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="1" listItemId="f" listType="bulleted">f</paragraph>' +
					'<paragraph listIndent="2" listItemId="g" listType="bulleted">g</paragraph>' +
					'<paragraph listIndent="1" listItemId="h" listType="bulleted">h</paragraph>' +
					'<paragraph listIndent="2" listItemId="i" listType="bulleted">i</paragraph>';

				const expectedModel =
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<nonListable foo="123">c</nonListable>' +
					'<paragraph listIndent="0" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="0" listItemId="f" listType="bulleted">f</paragraph>' +
					'<paragraph listIndent="1" listItemId="g" listType="bulleted">g</paragraph>' +
					'<paragraph listIndent="0" listItemId="h" listType="bulleted">h</paragraph>' +
					'<paragraph listIndent="1" listItemId="i" listType="bulleted">i</paragraph>';

				const selection = prepareTest( model, modelBefore );

				model.change( writer => {
					writer.rename( selection.getFirstPosition().nodeAfter, 'nonListable' );
				} );

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( expectedModel );
			} );
		} );

		describe( 'changing list attributes', () => {
			it( 'remove list attributes', () => {
				const modelBefore =
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[<paragraph listIndent="2" listItemId="c" listType="bulleted">c</paragraph>]' +
					'<paragraph listIndent="2" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="3" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="1" listItemId="f" listType="bulleted">f</paragraph>' +
					'<paragraph listIndent="2" listItemId="g" listType="bulleted">g</paragraph>' +
					'<paragraph listIndent="1" listItemId="h" listType="bulleted">h</paragraph>' +
					'<paragraph listIndent="2" listItemId="i" listType="bulleted">i</paragraph>';

				const expectedModel =
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph>c</paragraph>' +
					'<paragraph listIndent="0" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="0" listItemId="f" listType="bulleted">f</paragraph>' +
					'<paragraph listIndent="1" listItemId="g" listType="bulleted">g</paragraph>' +
					'<paragraph listIndent="0" listItemId="h" listType="bulleted">h</paragraph>' +
					'<paragraph listIndent="1" listItemId="i" listType="bulleted">i</paragraph>';

				const selection = prepareTest( model, modelBefore );
				const element = selection.getFirstPosition().nodeAfter;

				model.change( writer => {
					writer.removeAttribute( 'listItemId', element );
					writer.removeAttribute( 'listIndent', element );
					writer.removeAttribute( 'listType', element );
				} );

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( expectedModel );
			} );

			it( 'add list attributes', () => {
				const modelBefore =
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'[<paragraph>c</paragraph>]' +
					'<paragraph listIndent="0" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="2" listItemId="f" listType="bulleted">f</paragraph>' +
					'<paragraph listIndent="1" listItemId="g" listType="bulleted">g</paragraph>';

				const expectedModel =
					'<paragraph listIndent="0" listItemId="a" listType="bulleted">a</paragraph>' +
					'<paragraph listIndent="1" listItemId="b" listType="bulleted">b</paragraph>' +
					'<paragraph listIndent="2" listItemId="c" listType="bulleted">c</paragraph>' +
					'<paragraph listIndent="2" listItemId="d" listType="bulleted">d</paragraph>' +
					'<paragraph listIndent="1" listItemId="e" listType="bulleted">e</paragraph>' +
					'<paragraph listIndent="2" listItemId="f" listType="bulleted">f</paragraph>' +
					'<paragraph listIndent="1" listItemId="g" listType="bulleted">g</paragraph>';

				const selection = prepareTest( model, modelBefore );
				const element = selection.getFirstPosition().nodeAfter;

				model.change( writer => {
					writer.setAttribute( 'listItemId', 'c', element );
					writer.setAttribute( 'listIndent', 2, element );
					writer.setAttribute( 'listType', 'bulleted', element );
					writer.setAttribute( 'listIndent', 2, element.nextSibling );
				} );

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( expectedModel );
			} );
		} );
	} );

	describe( 'paste and insertContent integration', () => {
		it( 'should be triggered on DataController#insertContent()', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B[]</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			editor.model.insertContent(
				parseModel(
					'<listItem listType="bulleted" listIndent="0">X</listItem>' +
					'<listItem listType="bulleted" listIndent="1">Y</listItem>',
					model.schema
				)
			);

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">A</listItem>' +
				'<listItem listIndent="1" listType="bulleted">BX</listItem>' +
				'<listItem listIndent="2" listType="bulleted">Y[]</listItem>' +
				'<listItem listIndent="2" listType="bulleted">C</listItem>'
			);
		} );

		it( 'should be triggered when selectable is passed', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B[]</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			model.insertContent(
				parseModel(
					'<listItem listType="bulleted" listIndent="0">X</listItem>' +
					'<listItem listType="bulleted" listIndent="1">Y</listItem>',
					model.schema
				),
				model.createRange(
					model.createPositionFromPath( modelRoot, [ 1, 1 ] ),
					model.createPositionFromPath( modelRoot, [ 1, 1 ] )
				)
			);

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">A</listItem>' +
				'<listItem listIndent="1" listType="bulleted">B[]X</listItem>' +
				'<listItem listIndent="2" listType="bulleted">Y</listItem>' +
				'<listItem listIndent="2" listType="bulleted">C</listItem>'
			);
		} );

		// Just checking that it doesn't crash. #69
		it( 'should work if an element is passed to DataController#insertContent()', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B[]</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			model.change( writer => {
				const listItem = writer.createElement( 'listItem', { listType: 'bulleted', listIndent: '0' } );
				writer.insertText( 'X', listItem );

				model.insertContent( listItem );
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">A</listItem>' +
				'<listItem listIndent="1" listType="bulleted">BX[]</listItem>' +
				'<listItem listIndent="2" listType="bulleted">C</listItem>'
			);
		} );

		// Just checking that it doesn't crash. #69
		it( 'should work if an element is passed to DataController#insertContent() - case #69', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B[]</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			model.change( writer => {
				model.insertContent( writer.createText( 'X' ) );
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">A</listItem>' +
				'<listItem listIndent="1" listType="bulleted">BX[]</listItem>' +
				'<listItem listIndent="2" listType="bulleted">C</listItem>'
			);
		} );

		it( 'should fix indents of pasted list items', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B[]</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			const clipboard = editor.plugins.get( 'ClipboardPipeline' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>X<ul><li>Y</li></ul></li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">A</listItem>' +
				'<listItem listIndent="1" listType="bulleted">BX</listItem>' +
				'<listItem listIndent="2" listType="bulleted">Y[]</listItem>' +
				'<listItem listIndent="2" listType="bulleted">C</listItem>'
			);
		} );

		it( 'should not fix indents of list items that are separated by non-list element', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B[]</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			const clipboard = editor.plugins.get( 'ClipboardPipeline' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>W<ul><li>X</li></ul></li></ul><p>Y</p><ul><li>Z</li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">A</listItem>' +
				'<listItem listIndent="1" listType="bulleted">BW</listItem>' +
				'<listItem listIndent="2" listType="bulleted">X</listItem>' +
				'<paragraph>Y</paragraph>' +
				'<listItem listIndent="0" listType="bulleted">Z[]</listItem>' +
				'<listItem listIndent="1" listType="bulleted">C</listItem>'
			);
		} );

		it( 'should co-work correctly with post fixer', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B[]</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			const clipboard = editor.plugins.get( 'ClipboardPipeline' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<p>X</p><ul><li>Y</li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">A</listItem>' +
				'<listItem listIndent="1" listType="bulleted">BX</listItem>' +
				'<listItem listIndent="0" listType="bulleted">Y[]</listItem>' +
				'<listItem listIndent="1" listType="bulleted">C</listItem>'
			);
		} );

		it( 'should work if items are pasted between listItem elements', () => {
			// Wrap all changes in one block to avoid post-fixing the selection
			// (which may be incorret) in the meantime.
			model.change( () => {
				setModelData( model,
					'<listItem listType="bulleted" listIndent="0">A</listItem>' +
					'<listItem listType="bulleted" listIndent="1">B</listItem>[]' +
					'<listItem listType="bulleted" listIndent="2">C</listItem>'
				);

				const clipboard = editor.plugins.get( 'ClipboardPipeline' );

				clipboard.fire( 'inputTransformation', {
					content: parseView( '<ul><li>X<ul><li>Y</li></ul></li></ul>' )
				} );
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">A</listItem>' +
				'<listItem listIndent="1" listType="bulleted">B</listItem>' +
				'<listItem listIndent="1" listType="bulleted">X</listItem>' +
				'<listItem listIndent="2" listType="bulleted">Y[]</listItem>' +
				'<listItem listIndent="2" listType="bulleted">C</listItem>'
			);
		} );

		it( 'should create correct model when list items are pasted in top-level list', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A[]</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B</listItem>'
			);

			const clipboard = editor.plugins.get( 'ClipboardPipeline' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>X<ul><li>Y</li></ul></li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">AX</listItem>' +
				'<listItem listIndent="1" listType="bulleted">Y[]</listItem>' +
				'<listItem listIndent="1" listType="bulleted">B</listItem>'
			);
		} );

		it( 'should create correct model when list items are pasted in non-list context', () => {
			setModelData( model,
				'<paragraph>A[]</paragraph>' +
				'<paragraph>B</paragraph>'
			);

			const clipboard = editor.plugins.get( 'ClipboardPipeline' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>X<ul><li>Y</li></ul></li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<paragraph>AX</paragraph>' +
				'<listItem listIndent="0" listType="bulleted">Y[]</listItem>' +
				'<paragraph>B</paragraph>'
			);
		} );

		it( 'should not crash when "empty content" is inserted', () => {
			setModelData( model, '<paragraph>[]</paragraph>' );

			expect( () => {
				model.change( writer => {
					editor.model.insertContent( writer.createDocumentFragment() );
				} );
			} ).not.to.throw();
		} );

		it( 'should correctly handle item that is pasted without its parent', () => {
			// Wrap all changes in one block to avoid post-fixing the selection
			// (which may be incorret) in the meantime.
			model.change( () => {
				setModelData( model,
					'<paragraph>Foo</paragraph>' +
					'<listItem listType="numbered" listIndent="0">A</listItem>' +
					'<listItem listType="numbered" listIndent="1">B</listItem>' +
					'[]' +
					'<paragraph>Bar</paragraph>'
				);

				const clipboard = editor.plugins.get( 'ClipboardPipeline' );

				clipboard.fire( 'inputTransformation', {
					content: parseView( '<li>X</li>' )
				} );
			} );

			expect( getModelData( model ) ).to.equal(
				'<paragraph>Foo</paragraph>' +
				'<listItem listIndent="0" listType="numbered">A</listItem>' +
				'<listItem listIndent="1" listType="numbered">B</listItem>' +
				'<listItem listIndent="1" listType="numbered">X[]</listItem>' +
				'<paragraph>Bar</paragraph>'
			);
		} );

		it( 'should correctly handle item that is pasted without its parent #2', () => {
			// Wrap all changes in one block to avoid post-fixing the selection
			// (which may be incorret) in the meantime.
			model.change( () => {
				setModelData( model,
					'<paragraph>Foo</paragraph>' +
					'<listItem listType="numbered" listIndent="0">A</listItem>' +
					'<listItem listType="numbered" listIndent="1">B</listItem>' +
					'[]' +
					'<paragraph>Bar</paragraph>'
				);

				const clipboard = editor.plugins.get( 'ClipboardPipeline' );

				clipboard.fire( 'inputTransformation', {
					content: parseView( '<li>X<ul><li>Y</li></ul></li>' )
				} );
			} );

			expect( getModelData( model ) ).to.equal(
				'<paragraph>Foo</paragraph>' +
				'<listItem listIndent="0" listType="numbered">A</listItem>' +
				'<listItem listIndent="1" listType="numbered">B</listItem>' +
				'<listItem listIndent="1" listType="numbered">X</listItem>' +
				'<listItem listIndent="2" listType="bulleted">Y[]</listItem>' +
				'<paragraph>Bar</paragraph>'
			);
		} );

		it( 'should handle block elements inside pasted list #1', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B[]</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			const clipboard = editor.plugins.get( 'ClipboardPipeline' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>W<ul><li>X<p>Y</p>Z</li></ul></li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">A</listItem>' +
				'<listItem listIndent="1" listType="bulleted">BW</listItem>' +
				'<listItem listIndent="2" listType="bulleted">X</listItem>' +
				'<paragraph>Y</paragraph>' +
				'<listItem listIndent="0" listType="bulleted">Z[]</listItem>' +
				'<listItem listIndent="1" listType="bulleted">C</listItem>'
			);
		} );

		it( 'should handle block elements inside pasted list #2', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A[]</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			const clipboard = editor.plugins.get( 'ClipboardPipeline' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>W<ul><li>X<p>Y</p>Z</li></ul></li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">AW</listItem>' +
				'<listItem listIndent="1" listType="bulleted">X</listItem>' +
				'<paragraph>Y</paragraph>' +
				'<listItem listIndent="0" listType="bulleted">Z[]</listItem>' +
				'<listItem listIndent="0" listType="bulleted">B</listItem>' +
				'<listItem listIndent="1" listType="bulleted">C</listItem>'
			);
		} );

		it( 'should handle block elements inside pasted list #3', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A[]</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			const clipboard = editor.plugins.get( 'ClipboardPipeline' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li><p>W</p><p>X</p><p>Y</p></li><li>Z</li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">AW</listItem>' +
				'<paragraph>X</paragraph>' +
				'<paragraph>Y</paragraph>' +
				'<listItem listIndent="0" listType="bulleted">Z[]</listItem>' +
				'<listItem listIndent="1" listType="bulleted">B</listItem>' +
				'<listItem listIndent="2" listType="bulleted">C</listItem>'
			);
		} );

		// https://github.com/ckeditor/ckeditor5-list/issues/126#issuecomment-518206743
		it( 'should properly handle split of list items with non-standard converters', () => {
			setModelData( model,
				'<listItem listType="bulleted" listIndent="0">A[]</listItem>' +
				'<listItem listType="bulleted" listIndent="1">B</listItem>' +
				'<listItem listType="bulleted" listIndent="2">C</listItem>'
			);

			editor.model.schema.register( 'splitBlock', { inheritAllFrom: '$block' } );

			editor.conversion.for( 'downcast' ).elementToElement( { model: 'splitBlock', view: 'splitBlock' } );
			editor.conversion.for( 'upcast' ).add( dispatcher => dispatcher.on( 'element:splitBlock', ( evt, data, conversionApi ) => {
				conversionApi.consumable.consume( data.viewItem, { name: true } );

				// Use split to allowed parent logic to simulate a non-standard use of `modelCursor` after split.
				const splitBlock = conversionApi.writer.createElement( 'splitBlock' );
				conversionApi.safeInsert( splitBlock, data.modelCursor );

				data.modelRange = conversionApi.writer.createRangeOn( splitBlock );
				data.modelCursor = conversionApi.writer.createPositionAfter( splitBlock );
			} ) );

			const clipboard = editor.plugins.get( 'ClipboardPipeline' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>a<splitBlock></splitBlock>b</li></ul>' )
			} );

			expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
				'<listItem listIndent="0" listType="bulleted">Aa</listItem>' +
				'<splitBlock></splitBlock>' +
				'<listItem listIndent="0" listType="bulleted">b</listItem>' +
				'<listItem listIndent="1" listType="bulleted">B</listItem>' +
				'<listItem listIndent="2" listType="bulleted">C</listItem>'
			);
		} );
	} );

	describe( 'refreshing items on data change', () => {
	} );
} );
