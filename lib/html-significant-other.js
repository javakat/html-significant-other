var CompositeDisposable = require('event-kit').CompositeDisposable,
    Point = require('text-buffer').Point,
    AtomPackageDependencies = require('atom-package-dependencies'),
    TagFinder = require('bracket-matcher/lib/tag-finder'),
    Helpers = require('./html-significant-other-helpers')

AtomPackageDependencies.install()

module.exports = {

  activate: function (state) {
    var helpers = new Helpers()
    this.subscriptions = new CompositeDisposable
    this.subscriptions.add(atom.workspace.observeTextEditors((function (_this) {
      return function(editor) {
        var buffer = editor.getBuffer(),
            editorSubscriptions = new CompositeDisposable,
            tf = new TagFinder(editor);

        if(!helpers.isValidFileScope(editor)) return

        editorSubscriptions.add(buffer.onDidChange(function (e) {
          var cursor = editor.getCursorBufferPosition()
          if (e.newText == '>') {
            if (helpers.isValidBufferScope(editor.scopeDescriptorForBufferPosition(cursor))) {
              var selection,
                  tag = '',
                  openingAngleBracketIndex,
                  regexp = new RegExp("(<[a-zA-Z]+(>|.*?[^?]>))*<[a-zA-Z]+(>|.*?[^?]>)"),
                  matches

              editor.selectToBeginningOfLine()
              selection = editor.getSelectedText()

              // Check text between the > and the most recent preceding <
              // < ... >
              // Ignore it if it's a closing tag (e.g. </div>)
              // Expand if it isn't a closing tag, but isn't an opening tag
              // Repeat expansion until the text is the same as the entire selection,
              //   at which point, give up and ignore it.
              openingAngleBracketIndex = selection.lastIndexOf('<')
              tag = selection.substring(openingAngleBracketIndex)

              // If it's a closing tag, ignore it.
              if(tag.indexOf('</') == 0)
                tag = ''
              else {
                // Expand if it isn't a closing tag, but isn't an opening tag,
                //   and repeat until we're looking at the entire selection,
                //   at which point, give up and ignore it.
                while(!tag.match(regexp) && openingAngleBracketIndex > 0) {
                  openingAngleBracketIndex = selection.lastIndexOf('<', openingAngleBracketIndex - 1)
                  tag = selection.substring(openingAngleBracketIndex)
                }
                if(!tag.match(regexp))
                  tag = ''
              }
              // Should deselect if no match was found
              if(tag === '') {
                editor.selectToBufferPosition(cursor)
                return
              }
              // Should deselect if there are more > in the selection
              // than < -- meaning that we grabbed a complete tag, plus
              // some >
              var splitByOpeningAngles = tag.split('<'),
                  splitByClosingAngles = tag.split('>')
              if(splitByOpeningAngles.length < splitByClosingAngles.length) {
                editor.selectToBufferPosition(cursor)
                return
              }
              // Should select only the tag if the match isn't the whole selection
              if (tag !== selection) {
                var newCursor = new Point(cursor.row, selection.indexOf(tag))
                editor.setCursorBufferPosition(newCursor)
                editor.selectToBufferPosition(cursor)
              }

              // By this point, we have selected the new tag if there is one.
              // Now, read the tag, find out how (and if we need) to close it,
              // and do so, returning the cursor somewhere logical.
              if(tag !== '') {
                var tagName = ''
                if(tag.indexOf('<') === 0)
                  // If the tag closes and any attributes are listed...
                  if(tag.indexOf(' ') != -1 && tag.indexOf('>') > tag.indexOf(' ')) {
                    tagName = tag.substring(1, tag.indexOf(' '))
                  }
                  else
                    tagName = tag.substring(1, tag.indexOf('>'))

                if(tagName === '') return
                if(helpers.isVoidElement(tagName)
                || tf.findEndTag(tagName, cursor)) {
                  // Deselect everything.
                  // An auto-indent for your time, sir.
                  editor.setCursorBufferPosition(cursor)
                  editor.selectToBufferPosition(cursor)
                  editor.autoIndentSelectedRows()
                }
                else {
                  // Deselect everything, move back to the original position,
                  // place the closing tag, and move back (again)
                  editor.setCursorBufferPosition(cursor)
                  editor.selectToBufferPosition(cursor)
                  editor.insertText('</' + tagName + '>')
                  editor.setCursorBufferPosition(cursor)
                  editor.autoIndentSelectedRows()
                }
              }
            }
          }
        }))

        editorSubscriptions.add(buffer.onDidDestroy(function (e) {
          editorSubscriptions.dispose()
        }))

        _this.subscriptions.add(editorSubscriptions)
      };
    })(this)))

  },

  deactivate: function () {
    this.subscriptions.dispose()
  },

  serialize: function () {},

  toggle: function () {}
}
