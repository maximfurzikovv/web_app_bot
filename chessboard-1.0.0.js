// chessboard.js v1.0.0
// https://github.com/oakmac/chessboardjs/
//
// Copyright (c) 2019, Chris Oakman
// Released under the MIT license
// https://github.com/oakmac/chessboardjs/blob/master/LICENSE.md

// start anonymous scope
;(function () {
  'use strict'

  var $ = window['jQuery']

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  var COLUMNS = 'abcdefgh'.split('')
  var DEFAULT_DRAG_THROTTLE_RATE = 20
  var ELLIPSIS = '…'
  var MINIMUM_JQUERY_VERSION = '1.8.3'
  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
  var START_POSITION = fen_to_obj(START_FEN)

  // default animation speeds
  var DEFAULT_APPEAR_SPEED = 200
  var DEFAULT_MOVE_SPEED = 200
  var DEFAULT_SNAPBACK_SPEED = 60
  var DEFAULT_SNAP_SPEED = 30
  var DEFAULT_TRASH_SPEED = 100

  // use unique class names to prevent clashing with anything else on the page
  // and simplify selectors
  // NOTE: these should never change
  var CSS = {}
  CSS['alpha'] = 'alpha-d2270'
  CSS['black'] = 'black-3c85d'
  CSS['board'] = 'board-b72b1'
  CSS['chessboard'] = 'chessboard-63f37'
  CSS['clearfix'] = 'clearfix-7da63'
  CSS['highlight1'] = 'highlight1-32417'
  CSS['highlight2'] = 'highlight2-9c5d2'
  CSS['notation'] = 'notation-322f9'
  CSS['numeric'] = 'numeric-fc462'
  CSS['piece'] = 'piece-417db'
  CSS['row'] = 'row-5277c'
  CSS['sparePieces'] = 'spare-pieces-7492f'
  CSS['sparePiecesBottom'] = 'spare-pieces-bottom-ae20f'
  CSS['sparePiecesTop'] = 'spare-pieces-top-4028b'
  CSS['square'] = 'square-55d63'
  CSS['white'] = 'white-1e1d7'

  // ---------------------------------------------------------------------------
  // Misc Util Functions
  // ---------------------------------------------------------------------------

  function throttle (f, interval, scope) {
    var timeout = 0
    var shouldFire = false
    var args = []

    var handleTimeout = function () {
      timeout = 0
      if (shouldFire) {
        shouldFire = false
        fire()
      }
    }

    var fire = function () {
      timeout = window.setTimeout(handleTimeout, interval)
      f.apply(scope, args)
    }

    return function (_args) {
      args = arguments
      if (!timeout) {
        fire()
      } else {
        shouldFire = true
      }
    }
  }

  // function debounce (f, interval, scope) {
  //   var timeout = 0
  //   return function (_args) {
  //     window.clearTimeout(timeout)
  //     var args = arguments
  //     timeout = window.setTimeout(function () {
  //       f.apply(scope, args)
  //     }, interval)
  //   }
  // }

  function gen_uuid() {
        return 'xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
    }

  function deepCopy (thing) {
    return JSON.parse(JSON.stringify(thing))
  }

  function parseSemVer (version) {
    var tmp = version.split('.')
    return {
      major: parseInt(tmp[0], 10),
      minor: parseInt(tmp[1], 10),
      patch: parseInt(tmp[2], 10)
    }
  }

  // returns true if version is >= minimum
  function validSemanticVersion (version, minimum) {
    version = parseSemVer(version)
    minimum = parseSemVer(minimum)

    var versionNum = (version.major * 100000 * 100000) +
                     (version.minor * 100000) +
                     version.patch
    var minimumNum = (minimum.major * 100000 * 100000) +
                     (minimum.minor * 100000) +
                     minimum.patch

    return versionNum >= minimumNum
  }

  function replaceTemplate (str, obj) {
    for (var key in obj) {
      str = str.replace(new RegExp(`{${key}}`, 'g'), obj[key]);
    }
    return str;
  }


  // ---------------------------------------------------------------------------
  // Predicates
  // ---------------------------------------------------------------------------

  function isString (s) {
    return typeof s === 'string'
  }

  function isFunction (f) {
    return typeof f === 'function'
  }

  function isInteger (n) {
    return typeof n === 'number' &&
           isFinite(n) &&
           Math.floor(n) === n
  }

  function validAnimationSpeed (speed) {
    if (speed === 'fast' || speed === 'slow') return true
    if (!isInteger(speed)) return false
    return speed >= 0
  }

  function validThrottleRate (rate) {
    return isInteger(rate) &&
           rate >= 1
  }

  function validMove (move) {
    // move should be a string
    if (!isString(move)) return false

    // move should be in the form of "e2-e4", "f6-d5"
    var squares = move.split('-')
    if (squares.length !== 2) return false

    return validSquare(squares[0]) && validSquare(squares[1])
  }

  function validSquare (square) {
    return isString(square) && square.search(/^[a-h][1-8]$/) !== -1
  }


  function validPieceCode (code) {
    return isString(code) && code.search(/^[bw][KQRNBP]$/) !== -1
  }


  function validFen (fen) {
    if (!isString(fen)) return false

    // cut off any move, castling, etc info from the end
    // we're only interested in position information
    fen = fen.replace(/ .+$/, '')

    // expand the empty square numbers to just 1s
    fen = expandFenEmptySquares(fen)

    // FEN should be 8 sections separated by slashes
    var chunks = fen.split('/')
    if (chunks.length !== 8) return false

    // check each section
    for (var i = 0; i < 8; i++) {
      if (chunks[i].length !== 8 ||
          chunks[i].search(/[^kqrnbpKQRNBP1]/) !== -1) {
        return false
      }
    }

    return true
  }



  function validPositionObject (pos) {
    if (!$.isPlainObject(pos)) return false

    for (var i in pos) {
      if (!pos.hasOwnProperty(i)) continue

      if (!validSquare(i) || !validPieceCode(pos[i])) {
        return false
      }
    }

    return true
  }

  function isTouchDevice () {
    return 'ontouchstart' in document.documentElement
  }

  function validJQueryVersion () {
    return typeof window.$ &&
           $.fn &&
           $.fn.jquery &&
           validSemanticVersion($.fn.jquery, MINIMUM_JQUERY_VERSION)
  }

  // ---------------------------------------------------------------------------
  // Chess Util Functions
  // ---------------------------------------------------------------------------

  // convert FEN piece code to bP, wK, etc
  function fen_to_piececode (piece) {
    return (piece.toLowerCase() === piece ? 'b' : 'w') + piece.toUpperCase();
  }

  // convert bP, wK, etc code to FEN structure
  function piece_code_tofen (piece) {
    return (piece[0] === 'w' ? piece[1].toUpperCase() : piece[1].toLowerCase());
  }

  // convert FEN string to position object
  // returns false if the FEN string is invalid
  function fen_to_obj (fen) {
    var rows = fen.replace(/ .+$/, '').split('/'),
        position = {}, currentRow = 8;

    for (var row of rows) {
      var colIdx = 0;
      for (var char of row) {
        if (/[1-8]/.test(char)) {
          colIdx += parseInt(char, 10);
        } else {
          position[COLUMNS[colIdx++] + currentRow] = fen_to_piececode(char);
        }
      }
      currentRow--;
    }

    return position;
  }

  // position object to FEN string
  // returns false if the obj is not a valid position object
  function obj_tofen (obj) {
    var fen = '', currentRow = 8;
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        var square = COLUMNS[j] + currentRow;
        fen += obj.hasOwnProperty(square) ? piece_code_tofen(obj[square]) : '1';
      }
      fen += (i !== 7 ? '/' : '');
      currentRow--;
    }
    return fen;
  }



  function squeezeFenEmptySquares (fen) {
    return fen.replace(/11111111/g, '8')
      .replace(/1111111/g, '7')
      .replace(/111111/g, '6')
      .replace(/11111/g, '5')
      .replace(/1111/g, '4')
      .replace(/111/g, '3')
      .replace(/11/g, '2')
  }

  function expandFenEmptySquares (fen) {
    return fen.replace(/8/g, '11111111')
      .replace(/7/g, '1111111')
      .replace(/6/g, '111111')
      .replace(/5/g, '11111')
      .replace(/4/g, '1111')
      .replace(/3/g, '111')
      .replace(/2/g, '11')
  }

  // returns the distance between two squares
  function squareDistance (squareA, squareB) {
    var squareAArray = squareA.split('')
    var squareAx = COLUMNS.indexOf(squareAArray[0]) + 1
    var squareAy = parseInt(squareAArray[1], 10)

    var squareBArray = squareB.split('')
    var squareBx = COLUMNS.indexOf(squareBArray[0]) + 1
    var squareBy = parseInt(squareBArray[1], 10)

    var xDelta = Math.abs(squareAx - squareBx)
    var yDelta = Math.abs(squareAy - squareBy)

    if (xDelta >= yDelta) return xDelta
    return yDelta
  }

  // returns the square of the closest instance of piece
  // returns false if no instance of piece is found in position
  function findClosestPiece (position, piece, square) {
    // create array of closest squares from square
    var closestSquares = createRadius(square)

    // search through the position in order of distance for the piece
    for (var i = 0; i < closestSquares.length; i++) {
      var s = closestSquares[i]

      if (position.hasOwnProperty(s) && position[s] === piece) {
        return s
      }
    }

    return false
  }

  // returns an array of closest squares from square
  function createRadius (square) {
    var squares = []

    // calculate distance of all squares
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        var s = COLUMNS[i] + (j + 1)

        // skip the square we're starting from
        if (square === s) continue

        squares.push({
          square: s,
          distance: squareDistance(square, s)
        })
      }
    }

    // sort by distance
    squares.sort(function (a, b) {
      return a.distance - b.distance
    })

    // just return the square code
    var surroundingSquares = []
    for (i = 0; i < squares.length; i++) {
      surroundingSquares.push(squares[i].square)
    }

    return surroundingSquares
  }

  // given a position and a set of moves, return a new position
  // with the moves executed
  function calculatePositionFromMoves (position, moves) {
    var newPosition = deepCopy(position)

    for (var i in moves) {
      if (!moves.hasOwnProperty(i)) continue

      // skip the move if the position doesn't have a piece on the source square
      if (!newPosition.hasOwnProperty(i)) continue

      var piece = newPosition[i]
      delete newPosition[i]
      newPosition[moves[i]] = piece
    }

    return newPosition
  }

  // TODO: add some asserts here for calculatePositionFromMoves

  // ---------------------------------------------------------------------------
  // HTML
  // ---------------------------------------------------------------------------

  function createContainerHTML (hasSparePieces) {
    var html = '<div class="{chessboard}">'

    if (hasSparePieces) {
      html += '<div class="{sparePieces} {sparePiecesTop}"></div>'
    }

    html += '<div class="{board}"></div>'

    if (hasSparePieces) {
      html += '<div class="{sparePieces} {sparePiecesBottom}"></div>'
    }

    html += '</div>'

    return replaceTemplate(html, CSS)
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  function expandConfigArgumentShorthand (config) {
    if (config === 'start') {
      config = {position: deepCopy(START_POSITION)}
    } else if (validFen(config)) {
      config = {position: fen_to_obj(config)}
    } else if (validPositionObject(config)) {
      config = {position: deepCopy(config)}
    }

    // config must be an object
    if (!$.isPlainObject(config)) config = {}

    return config
  }

  // validate config / set default options
  function expandConfig (config) {
    if (config.orientation !== 'black') config.orientation = 'white'
    if (config.showNotation !== false) config.showNotation = true
    if (config.draggable !== true) config.draggable = false
    if (config.dropOffBoard !== 'trash') config.dropOffBoard = 'snapback'
    if (config.sparePieces !== true) config.sparePieces = false
    if (config.sparePieces) config.draggable = true
    if (!config.hasOwnProperty('pieceTheme') ||
        (!isString(config.pieceTheme) && !isFunction(config.pieceTheme))) {
      config.pieceTheme = '{piece}.jpeg'
    }

    return config
  }

  // ---------------------------------------------------------------------------
  // Dependencies
  // ---------------------------------------------------------------------------

  // check for a compatible version of jQuery
  function checkJQuery () {
    if (!validJQueryVersion()) {
      var errorMsg = 'Chessboard Error 1005: Unable to find a valid version of jQuery. ' +
        'Please include jQuery ' + MINIMUM_JQUERY_VERSION + ' or higher on the page' +
        '\n\n' +
        'Exiting' + ELLIPSIS
      window.alert(errorMsg)
      return false
    }

    return true
  }

  // return either boolean false or the $container element
  function checkContainerArg (containerElOrString) {
      if (!containerElOrString || !containerElOrString.startsWith('#')) {
          containerElOrString = `#${containerElOrString}`;
      }

      var $container = $(containerElOrString);
      if ($container.length !== 1) {
          window.alert('Chessboard Error: The first argument must be a valid DOM node or ID.');
          return false;
      }

      return $container;
  }

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  function constructor (containerElOrString, config) {

    var $container = checkContainerArg(containerElOrString)

    config = expandConfig(config)

    // DOM elements
    var $board = null
    var $draggedPiece = null
    var $sparePiecesTop = null
    var $sparePiecesBottom = null

    // constructor return object
    var widget = {}

    // -------------------------------------------------------------------------
    // Stateful
    // -------------------------------------------------------------------------

    var boardBorderSize = 2
    var currentOrientation = 'white'
    var currentPosition = {}
    var draggedPiece = null
    var draggedPieceLocation = null
    var draggedPieceSource = null
    var isDragging = false
    var sparePiecesElsIds = {}
    var squareElsIds = {}
    var squareElsOffsets = {}
    var squareSize = 16

    // -------------------------------------------------------------------------
    // Validation / Errors
    // -------------------------------------------------------------------------

/*    function error (code, msg, obj) {
      // do nothing if showErrors is not set
      if (
        config.hasOwnProperty('showErrors') !== true ||
          config.showErrors === false
      ) {
        return
      }

      var errorText = 'Chessboard Error ' + code + ': ' + msg

      // print to console
      if (
        config.showErrors === 'console' &&
          typeof console === 'object' &&
          typeof console.log === 'function'
      ) {
        console.log(errorText)
        if (arguments.length >= 2) {
          console.log(obj)
        }
        return
      }

      // alert errors
      if (config.showErrors === 'alert') {
        if (obj) {
          errorText += '\n\n' + JSON.stringify(obj)
        }
        window.alert(errorText)
        return
      }

      // custom function
      if (isFunction(config.showErrors)) {
        config.showErrors(code, msg, obj)
      }
    }*/
    function setInitialState() {
        if (config.position === 'start') {
            currentPosition = deepCopy(START_POSITION);
        } else if (config.position) {
            error(7263, 'Invalid value passed to config.position.', config.position);
        }
    }

    // -------------------------------------------------------------------------
    // DOM Misc
    // -------------------------------------------------------------------------

    // calculates square size based on the width of the container
    // got a little CSS black magic here, so let me explain:
    // get the width of the container element (could be anything), reduce by 1 for
    // fudge factor, and then keep reducing until we find an exact mod 8 for
    // our square size
    function calculateSquareSize() {
        var containerWidth = parseInt($container.width(), 10);
        if (containerWidth <= 0) return 0;
        
        var boardWidth = containerWidth - 1;
        while (boardWidth % 8 !== 0 && boardWidth > 0) boardWidth--;
        return boardWidth / 8;
    }

    // create random IDs for elements
    function createElIds() {
        COLUMNS.forEach((col, i) => {
            for (var j = 1; j <= 8; j++) {
                var square = col + j;
                squareElsIds[square] = square + '-' + gen_uuid();
            }
        });

        'KQRNBP'.split('').forEach(piece => {
            sparePiecesElsIds['w' + piece] = 'w' + piece + '-' + gen_uuid();
            sparePiecesElsIds['b' + piece] = 'b' + piece + '-' + gen_uuid();
        });
    }

    // -------------------------------------------------------------------------
    // Markup Building
    // -------------------------------------------------------------------------

    function buildBoardHTML (orientation) {
      if (orientation !== 'black') {
        orientation = 'white'
      }

      var html = ''

      // algebraic notation / orientation
      var alpha = deepCopy(COLUMNS)
      var row = 8
      if (orientation === 'black') {
        alpha.reverse()
        row = 1
      }

      var squareColor = 'white'
      for (var i = 0; i < 8; i++) {
        html += '<div class="{row}">'
        for (var j = 0; j < 8; j++) {
          var square = alpha[j] + row

          html += '<div class="{square} ' + CSS[squareColor] + ' ' +
            'square-' + square + '" ' +
            'style="width:' + squareSize + 'px;height:' + squareSize + 'px;" ' +
            'id="' + squareElsIds[square] + '" ' +
            'data-square="' + square + '">'

          if (config.showNotation) {
            // alpha notation
            if ((orientation === 'white' && row === 1) ||
                (orientation === 'black' && row === 8)) {
              html += '<div class="{notation} {alpha}">' + alpha[j] + '</div>'
            }

            // numeric notation
            if (j === 0) {
              html += '<div class="{notation} {numeric}">' + row + '</div>'
            }
          }

          html += '</div>' // end .square

          squareColor = (squareColor === 'white') ? 'black' : 'white'
        }
        html += '<div class="{clearfix}"></div></div>'

        squareColor = (squareColor === 'white') ? 'black' : 'white'

        if (orientation === 'white') {
          row = row - 1
        } else {
          row = row + 1
        }
      }

      return replaceTemplate(html, CSS)
    }

    function buildPieceImgSrc (piece) {
      if (isFunction(config.pieceTheme)) {
        return config.pieceTheme(piece)
      }

      if (isString(config.pieceTheme)) {
        return replaceTemplate(config.pieceTheme, {piece: piece})
      }

      // NOTE: this should never happen
      error(8272, 'Unable to build image source for config.pieceTheme.')
      return ''
    }

    function buildPieceHTML (piece, hidden, id) {
      var html = '<img src="' + buildPieceImgSrc(piece) + '" '
      if (isString(id) && id !== '') {
        html += 'id="' + id + '" '
      }
      html += 'alt="" ' +
        'class="{piece}" ' +
        'data-piece="' + piece + '" ' +
        'style="width:' + squareSize + 'px;' + 'height:' + squareSize + 'px;'

      if (hidden) {
        html += 'display:none;'
      }

      html += '" />'

      return replaceTemplate(html, CSS)
    }

    function buildSparePiecesHTML (color) {
      var pieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP']
      if (color === 'black') {
        pieces = ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP']
      }

      var html = ''
      for (var i = 0; i < pieces.length; i++) {
        html += buildPieceHTML(pieces[i], false, sparePiecesElsIds[pieces[i]])
      }

      return html
    }


    function animateSquareToSquare (src, dest, piece, completeFn) {
      // get information about the source and destination squares
      var $srcSquare = $('#' + squareElsIds[src])
      var srcSquarePosition = $srcSquare.offset()
      var $destSquare = $('#' + squareElsIds[dest])
      var destSquarePosition = $destSquare.offset()

      // create the animated piece and absolutely position it
      // over the source square
      var animatedPieceId = gen_uuid()
      $('body').append(buildPieceHTML(piece, true, animatedPieceId))
      var $animatedPiece = $('#' + animatedPieceId)
      $animatedPiece.css({
        display: '',
        position: 'absolute',
        top: srcSquarePosition.top,
        left: srcSquarePosition.left
      })

      // remove original piece from source square
      $srcSquare.find('.' + CSS.piece).remove()

      function onFinishAnimation1 () {
        // add the "real" piece to the destination square
        $destSquare.append(buildPieceHTML(piece))

        // remove the animated piece
        $animatedPiece.remove()

        // run complete function
        if (isFunction(completeFn)) {
          completeFn()
        }
      }

      // animate the piece to the destination square
      var opts = {
        duration: config.moveSpeed,
        complete: onFinishAnimation1
      }
      $animatedPiece.animate(destSquarePosition, opts)
    }

    function animateSparePieceToSquare (piece, dest, completeFn) {
      var srcOffset = $('#' + sparePiecesElsIds[piece]).offset()
      var $destSquare = $('#' + squareElsIds[dest])
      var destOffset = $destSquare.offset()

      // create the animate piece
      var pieceId = gen_uuid()
      $('body').append(buildPieceHTML(piece, true, pieceId))
      var $animatedPiece = $('#' + pieceId)
      $animatedPiece.css({
        display: '',
        position: 'absolute',
        left: srcOffset.left,
        top: srcOffset.top
      })

      // on complete
      function onFinishAnimation2 () {
        // add the "real" piece to the destination square
        $destSquare.find('.' + CSS.piece).remove()
        $destSquare.append(buildPieceHTML(piece))

        // remove the animated piece
        $animatedPiece.remove()

        // run complete function
        if (isFunction(completeFn)) {
          completeFn()
        }
      }

      // animate the piece to the destination square
      var opts = {
        duration: config.moveSpeed,
        complete: onFinishAnimation2
      }
      $animatedPiece.animate(destOffset, opts)
    }

    // execute an array of animations
    function doAnimations (animations, oldPos, newPos) {
      if (animations.length === 0) return

      var numFinished = 0
      function onFinishAnimation3 () {
        // exit if all the animations aren't finished
        numFinished = numFinished + 1
        if (numFinished !== animations.length) return

        drawPositionInstant()

        // run their onMoveEnd function
        if (isFunction(config.onMoveEnd)) {
          config.onMoveEnd(deepCopy(oldPos), deepCopy(newPos))
        }
      }

      for (var i = 0; i < animations.length; i++) {
        var animation = animations[i]

        // clear a piece
        if (animation.type === 'clear') {
          $('#' + squareElsIds[animation.square] + ' .' + CSS.piece)
            .fadeOut(config.trashSpeed, onFinishAnimation3)

        // add a piece with no spare pieces - fade the piece onto the square
        } else if (animation.type === 'add' && !config.sparePieces) {
          $('#' + squareElsIds[animation.square])
            .append(buildPieceHTML(animation.piece, true))
            .find('.' + CSS.piece)
            .fadeIn(config.appearSpeed, onFinishAnimation3)

        // add a piece with spare pieces - animate from the spares
        } else if (animation.type === 'add' && config.sparePieces) {
          animateSparePieceToSquare(animation.piece, animation.square, onFinishAnimation3)

        // move a piece from squareA to squareB
        } else if (animation.type === 'move') {
          animateSquareToSquare(animation.source, animation.destination, animation.piece, onFinishAnimation3)
        }
      }
    }

    // calculate an array of animations that need to happen in order to get
    // from pos1 to pos2
    function calculateAnimations (pos1, pos2) {
      // make copies of both
      pos1 = deepCopy(pos1)
      pos2 = deepCopy(pos2)

      var animations = []
      var squaresMovedTo = {}

      // remove pieces that are the same in both positions
      for (var i in pos2) {
        if (!pos2.hasOwnProperty(i)) continue

        if (pos1.hasOwnProperty(i) && pos1[i] === pos2[i]) {
          delete pos1[i]
          delete pos2[i]
        }
      }

      // find all the "move" animations
      for (i in pos2) {
        if (!pos2.hasOwnProperty(i)) continue

        var closestPiece = findClosestPiece(pos1, pos2[i], i)
        if (closestPiece) {
          animations.push({
            type: 'move',
            source: closestPiece,
            destination: i,
            piece: pos2[i]
          })

          delete pos1[closestPiece]
          delete pos2[i]
          squaresMovedTo[i] = true
        }
      }

      // "add" animations
      for (i in pos2) {
        if (!pos2.hasOwnProperty(i)) continue

        animations.push({
          type: 'add',
          square: i,
          piece: pos2[i]
        })

        delete pos2[i]
      }

      // "clear" animations
      for (i in pos1) {
        if (!pos1.hasOwnProperty(i)) continue

        // do not clear a piece if it is on a square that is the result
        // of a "move", ie: a piece capture
        if (squaresMovedTo.hasOwnProperty(i)) continue

        animations.push({
          type: 'clear',
          square: i,
          piece: pos1[i]
        })

        delete pos1[i]
      }

      return animations
    }

    // -------------------------------------------------------------------------
    // Control Flow
    // -------------------------------------------------------------------------

    function drawPositionInstant () {
      // clear the board
      $board.find('.' + CSS.piece).remove()

      // add the pieces
      for (var i in currentPosition) {
        if (!currentPosition.hasOwnProperty(i)) continue

        $('#' + squareElsIds[i]).append(buildPieceHTML(currentPosition[i]))
      }
    }

    function drawBoard () {
      $board.html(buildBoardHTML(currentOrientation, squareSize, config.showNotation))
      drawPositionInstant()

      if (config.sparePieces) {
        if (currentOrientation === 'white') {
          $sparePiecesTop.html(buildSparePiecesHTML('black'))
          $sparePiecesBottom.html(buildSparePiecesHTML('white'))
        } else {
          $sparePiecesTop.html(buildSparePiecesHTML('white'))
          $sparePiecesBottom.html(buildSparePiecesHTML('black'))
        }
      }
    }

    function setCurrentPosition (position) {
      var oldPos = deepCopy(currentPosition)
      var newPos = deepCopy(position)
      var oldFen = obj_tofen(oldPos)
      var newFen = obj_tofen(newPos)

      // do nothing if no change in position
      if (oldFen === newFen) return

      // run their onChange function
      if (isFunction(config.onChange)) {
        config.onChange(oldPos, newPos)
      }

      // update state
      currentPosition = position
    }

    function isXYOnSquare (x, y) {
      for (var i in squareElsOffsets) {
        if (!squareElsOffsets.hasOwnProperty(i)) continue

        var s = squareElsOffsets[i]
        if (x >= s.left &&
            x < s.left + squareSize &&
            y >= s.top &&
            y < s.top + squareSize) {
          return i
        }
      }

      return 'offboard'
    }

    // records the XY coords of every square into memory
    function captureSquareOffsets () {
      squareElsOffsets = {}

      for (var i in squareElsIds) {
        if (!squareElsIds.hasOwnProperty(i)) continue

        squareElsOffsets[i] = $('#' + squareElsIds[i]).offset()
      }
    }

    function removeSquareHighlights () {
      $board
        .find('.' + CSS.square)
        .removeClass(CSS.highlight1 + ' ' + CSS.highlight2)
    }

    function snapbackDraggedPiece () {
      // there is no "snapback" for spare pieces
      if (draggedPieceSource === 'spare') {
        trashDraggedPiece()
        return
      }

      removeSquareHighlights()

      // animation complete
      function complete () {
        drawPositionInstant()
        $draggedPiece.css('display', 'none')

        // run their onSnapbackEnd function
        if (isFunction(config.onSnapbackEnd)) {
          config.onSnapbackEnd(
            draggedPiece,
            draggedPieceSource,
            deepCopy(currentPosition),
            currentOrientation
          )
        }
      }

      // get source square position
      var sourceSquarePosition = $('#' + squareElsIds[draggedPieceSource]).offset()

      // animate the piece to the target square
      var opts = {
        duration: config.snapbackSpeed,
        complete: complete
      }
      $draggedPiece.animate(sourceSquarePosition, opts)

      // set state
      isDragging = false
    }

    function trashDraggedPiece () {
      removeSquareHighlights()

      // remove the source piece
      var newPosition = deepCopy(currentPosition)
      delete newPosition[draggedPieceSource]
      setCurrentPosition(newPosition)

      // redraw the position
      drawPositionInstant()

      // hide the dragged piece
      $draggedPiece.fadeOut(config.trashSpeed)

      // set state
      isDragging = false
    }

    function dropDraggedPieceOnSquare (square) {
      removeSquareHighlights()

      // update position
      var newPosition = deepCopy(currentPosition)
      delete newPosition[draggedPieceSource]
      newPosition[square] = draggedPiece
      setCurrentPosition(newPosition)

      // get target square information
      var targetSquarePosition = $('#' + squareElsIds[square]).offset()

      // animation complete
      function onAnimationComplete () {
        drawPositionInstant()
        $draggedPiece.css('display', 'none')

        // execute their onSnapEnd function
        if (isFunction(config.onSnapEnd)) {
          config.onSnapEnd(draggedPieceSource, square, draggedPiece)
        }
      }

      // snap the piece to the target square
      var opts = {
        duration: config.snapSpeed,
        complete: onAnimationComplete
      }
      $draggedPiece.animate(targetSquarePosition, opts)

      // set state
      isDragging = false
    }

    function beginDraggingPiece (source, piece, x, y) {
      // run their custom onDragStart function
      // their custom onDragStart function can cancel drag start
      if (isFunction(config.onDragStart) &&
          config.onDragStart(source, piece, deepCopy(currentPosition), currentOrientation) === false) {
        return
      }

      // set state
      isDragging = true
      draggedPiece = piece
      draggedPieceSource = source

      // if the piece came from spare pieces, location is offboard
      if (source === 'spare') {
        draggedPieceLocation = 'offboard'
      } else {
        draggedPieceLocation = source
      }

      // capture the x, y coords of all squares in memory
      captureSquareOffsets()

      // create the dragged piece
      $draggedPiece.attr('src', buildPieceImgSrc(piece)).css({
        display: '',
        position: 'absolute',
        left: x - squareSize / 2,
        top: y - squareSize / 2
      })

      if (source !== 'spare') {
        // highlight the source square and hide the piece
        $('#' + squareElsIds[source])
          .addClass(CSS.highlight1)
          .find('.' + CSS.piece)
          .css('display', 'none')
      }
    }

    function updateDraggedPiece (x, y) {
      // put the dragged piece over the mouse cursor
      $draggedPiece.css({
        left: x - squareSize / 2,
        top: y - squareSize / 2
      })

      // get location
      var location = isXYOnSquare(x, y)

      // do nothing if the location has not changed
      if (location === draggedPieceLocation) return

      // remove highlight from previous square
      if (validSquare(draggedPieceLocation)) {
        $('#' + squareElsIds[draggedPieceLocation]).removeClass(CSS.highlight2)
      }

      // add highlight to new square
      if (validSquare(location)) {
        $('#' + squareElsIds[location]).addClass(CSS.highlight2)
      }

      // run onDragMove
      if (isFunction(config.onDragMove)) {
        config.onDragMove(
          location,
          draggedPieceLocation,
          draggedPieceSource,
          draggedPiece,
          deepCopy(currentPosition),
          currentOrientation
        )
      }

      // update state
      draggedPieceLocation = location
    }

    function stopDraggedPiece (location) {
      // determine what the action should be
      var action = 'drop'
      if (location === 'offboard' && config.dropOffBoard === 'snapback') {
        action = 'snapback'
      }
      if (location === 'offboard' && config.dropOffBoard === 'trash') {
        action = 'trash'
      }

      // run their onDrop function, which can potentially change the drop action
      if (isFunction(config.onDrop)) {
        var newPosition = deepCopy(currentPosition)

        // source piece is a spare piece and position is off the board
        // if (draggedPieceSource === 'spare' && location === 'offboard') {...}
        // position has not changed; do nothing

        // source piece is a spare piece and position is on the board
        if (draggedPieceSource === 'spare' && validSquare(location)) {
          // add the piece to the board
          newPosition[location] = draggedPiece
        }

        // source piece was on the board and position is off the board
        if (validSquare(draggedPieceSource) && location === 'offboard') {
          // remove the piece from the board
          delete newPosition[draggedPieceSource]
        }

        // source piece was on the board and position is on the board
        if (validSquare(draggedPieceSource) && validSquare(location)) {
          // move the piece
          delete newPosition[draggedPieceSource]
          newPosition[location] = draggedPiece
        }

        var oldPosition = deepCopy(currentPosition)

        var result = config.onDrop(
          draggedPieceSource,
          location,
          draggedPiece,
          newPosition,
          oldPosition,
          currentOrientation
        )
        if (result === 'snapback' || result === 'trash') {
          action = result
        }
      }

      // do it!
      if (action === 'snapback') {
        snapbackDraggedPiece()
      } else if (action === 'trash') {
        trashDraggedPiece()
      } else if (action === 'drop') {
        dropDraggedPieceOnSquare(location)
      }
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    // clear the board
    widget.clear = function (useAnimation) {
      widget.position({}, useAnimation)
    }

    // remove the widget from the page
    widget.destroy = function () {
      // remove markup
      $container.html('')
      $draggedPiece.remove()

      // remove event handlers
      $container.unbind()
    }

    // shorthand method to get the current FEN
    widget.fen = function () {
      return widget.position('fen')
    }

    // flip orientation
    widget.flip = function () {
      return widget.orientation('flip')
    }

    // move pieces
    // TODO: this method should be variadic as well as accept an array of moves
    widget.move = function () {
      // no need to throw an error here; just do nothing
      // TODO: this should return the current position
      if (arguments.length === 0) return

      var useAnimation = true

      // collect the moves into an object
      var moves = {}
      for (var i = 0; i < arguments.length; i++) {
        // any "false" to this function means no animations
        if (arguments[i] === false) {
          useAnimation = false
          continue
        }

        // skip invalid arguments
        if (!validMove(arguments[i])) {
          error(2826, 'Invalid move passed to the move method.', arguments[i])
          continue
        }

        var tmp = arguments[i].split('-')
        moves[tmp[0]] = tmp[1]
      }

      // calculate position from moves
      var newPos = calculatePositionFromMoves(currentPosition, moves)

      // update the board
      widget.position(newPos, useAnimation)

      // return the new position object
      return newPos
    }

    widget.orientation = function (arg) {
      // no arguments, return the current orientation
      if (arguments.length === 0) {
        return currentOrientation
      }

      // set to white or black
      if (arg === 'white' || arg === 'black') {
        currentOrientation = arg
        drawBoard()
        return currentOrientation
      }

      // flip orientation
      if (arg === 'flip') {
        currentOrientation = currentOrientation === 'white' ? 'black' : 'white'
        drawBoard()
        return currentOrientation
      }

      error(5482, 'Invalid value passed to the orientation method.', arg)
    }

    widget.position = function (position, useAnimation) {
      // no arguments, return the current position
      if (arguments.length === 0) {
        return deepCopy(currentPosition)
      }

      // get position as FEN
      if (isString(position) && position.toLowerCase() === 'fen') {
        return obj_tofen(currentPosition)
      }

      // start position
      if (isString(position) && position.toLowerCase() === 'start') {
        position = deepCopy(START_POSITION)
      }

      // convert FEN to position object
      if (validFen(position)) {
        position = fen_to_obj(position)
      }

      // validate position object
      if (!validPositionObject(position)) {
        error(6482, 'Invalid value passed to the position method.', position)
        return
      }

      // default for useAnimations is true
      if (useAnimation !== false) useAnimation = true

      if (useAnimation) {
        // start the animations
        var animations = calculateAnimations(currentPosition, position)
        doAnimations(animations, currentPosition, position)

        // set the new position
        setCurrentPosition(position)
      } else {
        // instant update
        setCurrentPosition(position)
        drawPositionInstant()
      }
    }

    widget.resize = function () {
      // calulate the new square size
      squareSize = calculateSquareSize()

      // set board width
      $board.css('width', squareSize * 8 + 'px')

      // set drag piece size
      $draggedPiece.css({
        height: squareSize,
        width: squareSize
      })

      // spare pieces
      if (config.sparePieces) {
        $container
          .find('.' + CSS.sparePieces)
          .css('paddingLeft', squareSize + boardBorderSize + 'px')
      }

      // redraw the board
      drawBoard()
    }

    // set the starting position
    widget.start = function (useAnimation) {
      widget.position('start', useAnimation)
    }

    // -------------------------------------------------------------------------
    // Browser Events
    // -------------------------------------------------------------------------

    function stopDefault (evt) {
      evt.preventDefault()
    }

    function mousedownSquare (evt) {
      // do nothing if we're not draggable
      if (!config.draggable) return

      // do nothing if there is no piece on this square
      var square = $(this).attr('data-square')
      if (!validSquare(square)) return
      if (!currentPosition.hasOwnProperty(square)) return

      beginDraggingPiece(square, currentPosition[square], evt.pageX, evt.pageY)
    }

    function touchstartSquare (e) {
      // do nothing if we're not draggable
      if (!config.draggable) return

      // do nothing if there is no piece on this square
      var square = $(this).attr('data-square')
      if (!validSquare(square)) return
      if (!currentPosition.hasOwnProperty(square)) return

      e = e.originalEvent
      beginDraggingPiece(
        square,
        currentPosition[square],
        e.changedTouches[0].pageX,
        e.changedTouches[0].pageY
      )
    }

    function mousedownSparePiece (evt) {
      // do nothing if sparePieces is not enabled
      if (!config.sparePieces) return

      var piece = $(this).attr('data-piece')

      beginDraggingPiece('spare', piece, evt.pageX, evt.pageY)
    }

    function touchstartSparePiece (e) {
      // do nothing if sparePieces is not enabled
      if (!config.sparePieces) return

      var piece = $(this).attr('data-piece')

      e = e.originalEvent
      beginDraggingPiece(
        'spare',
        piece,
        e.changedTouches[0].pageX,
        e.changedTouches[0].pageY
      )
    }

    function mousemoveWindow (evt) {
      if (isDragging) {
        updateDraggedPiece(evt.pageX, evt.pageY)
      }
    }

    var throttledMousemoveWindow = throttle(mousemoveWindow, config.dragThrottleRate)

    function touchmoveWindow (evt) {
      // do nothing if we are not dragging a piece
      if (!isDragging) return

      // prevent screen from scrolling
      evt.preventDefault()

      updateDraggedPiece(evt.originalEvent.changedTouches[0].pageX,
        evt.originalEvent.changedTouches[0].pageY)
    }

    var throttledTouchmoveWindow = throttle(touchmoveWindow, config.dragThrottleRate)

    function mouseupWindow (evt) {
      // do nothing if we are not dragging a piece
      if (!isDragging) return

      // get the location
      var location = isXYOnSquare(evt.pageX, evt.pageY)

      stopDraggedPiece(location)
    }

    function touchendWindow (evt) {
      // do nothing if we are not dragging a piece
      if (!isDragging) return

      // get the location
      var location = isXYOnSquare(evt.originalEvent.changedTouches[0].pageX,
        evt.originalEvent.changedTouches[0].pageY)

      stopDraggedPiece(location)
    }

    function mouseenterSquare (evt) {
      // do not fire this event if we are dragging a piece
      // NOTE: this should never happen, but it's a safeguard
      if (isDragging) return

      // exit if they did not provide a onMouseoverSquare function
      if (!isFunction(config.onMouseoverSquare)) return

      // get the square
      var square = $(evt.currentTarget).attr('data-square')

      // NOTE: this should never happen; defensive
      if (!validSquare(square)) return

      // get the piece on this square
      var piece = false
      if (currentPosition.hasOwnProperty(square)) {
        piece = currentPosition[square]
      }

      // execute their function
      config.onMouseoverSquare(square, piece, deepCopy(currentPosition), currentOrientation)
    }

    function mouseleaveSquare (evt) {
      // do not fire this event if we are dragging a piece
      // NOTE: this should never happen, but it's a safeguard
      if (isDragging) return

      // exit if they did not provide an onMouseoutSquare function
      if (!isFunction(config.onMouseoutSquare)) return

      // get the square
      var square = $(evt.currentTarget).attr('data-square')

      // NOTE: this should never happen; defensive
      if (!validSquare(square)) return

      // get the piece on this square
      var piece = false
      if (currentPosition.hasOwnProperty(square)) {
        piece = currentPosition[square]
      }

      // execute their function
      config.onMouseoutSquare(square, piece, deepCopy(currentPosition), currentOrientation)
    }

    // -------------------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------------------

    function addEvents () {
      // prevent "image drag"
      $('body').on('mousedown mousemove', '.' + CSS.piece, stopDefault)

      // mouse drag pieces
      $board.on('mousedown', '.' + CSS.square, mousedownSquare)
      $container.on('mousedown', '.' + CSS.sparePieces + ' .' + CSS.piece, mousedownSparePiece)

      // mouse enter / leave square
      $board
        .on('mouseenter', '.' + CSS.square, mouseenterSquare)
        .on('mouseleave', '.' + CSS.square, mouseleaveSquare)

      // piece drag
      var $window = $(window)
      $window
        .on('mousemove', throttledMousemoveWindow)
        .on('mouseup', mouseupWindow)

      // touch drag pieces
      if (isTouchDevice()) {
        $board.on('touchstart', '.' + CSS.square, touchstartSquare)
        $container.on('touchstart', '.' + CSS.sparePieces + ' .' + CSS.piece, touchstartSparePiece)
        $window
          .on('touchmove', throttledTouchmoveWindow)
          .on('touchend', touchendWindow)
      }
    }

    function initDOM () {
      // create unique IDs for all the elements we will create
      createElIds()

      // build board and save it in memory
      $container.html(createContainerHTML(config.sparePieces))
      $board = $container.find('.' + CSS.board)

      if (config.sparePieces) {
        $sparePiecesTop = $container.find('.' + CSS.sparePiecesTop)
        $sparePiecesBottom = $container.find('.' + CSS.sparePiecesBottom)
      }

      // create the drag piece
      var draggedPieceId = gen_uuid()
      $('body').append(buildPieceHTML('wP', true, draggedPieceId))
      $draggedPiece = $('#' + draggedPieceId)

      // TODO: need to remove this dragged piece element if the board is no
      // longer in the DOM

      // get the border size
      boardBorderSize = parseInt($board.css('borderLeftWidth'), 10)

      // set the size and draw the board
      widget.resize()
    }

    // -------------------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------------------

    setInitialState()
    initDOM()
    addEvents()

    // return the widget object
    return widget
  } // end constructor

  // TODO: do module exports here
  window['Chessboard'] = constructor

  // support legacy ChessBoard name
  window['ChessBoard'] = window['Chessboard']

  // expose util functions
  window['Chessboard']['fen_to_obj'] = fen_to_obj
  window['Chessboard']['obj_tofen'] = obj_tofen
})() // end anonymous wrapper
